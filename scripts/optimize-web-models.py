"""Compress AMSA's authored GLBs without changing geometry or texture resolution.

Run with Blender's bundled Python (NumPy and the official Meshoptimizer bridge):
  "C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe" \
      scripts/optimize-web-models.py

The initial published files are retained in design-source/model-archive. Every
run starts from those references, preventing cumulative quantization. Images,
materials, node hierarchy, triangles, and vertex counts remain unchanged.
Only vertex float precision is reduced: positions use adaptive 13–16-bit
mantissas with a measured 0.00005-unit error ceiling; normals use 12-bit
octahedral packing; UVs use normalized 16-bit integers.
Actual decoded error is measured before either file changes.
"""
import copy
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BLENDER = Path(os.environ.get("AMSA_BLENDER_DIRECTORY", "C:/Program Files/Blender Foundation/Blender 5.2"))
EXTENSION = "EXT_meshopt_compression"
PRECISION = {"POSITION": 16, "NORMAL": 12, "TEXCOORD_0": 16}
DLL_DIRECTORY = os.add_dll_directory(str(BLENDER / "blender.shared")) if os.name == "nt" else None
LIB = ctypes.CDLL(str(BLENDER / "5.2/scripts/addons_core/io_scene_gltf2/bf_intern_meshopt_bridge.dll"))


def bind(name, arguments, result):
    function = getattr(LIB, name)
    function.argtypes = arguments
    function.restype = result
    return function


PTR, SIZE, INT = ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int
bind("encodeVertexVersion", [INT], None)(0)
bind("encodeIndexVersion", [INT], None)(1)
for name in ["encodeVertexBufferBound", "encodeIndexBufferBound", "encodeIndexSequenceBound"]:
    bind(name, [SIZE, SIZE], SIZE)
bind("encodeVertexBuffer", [PTR, SIZE, PTR, SIZE, SIZE], SIZE)
for name in ["encodeIndexBuffer", "encodeIndexSequence"]:
    bind(name, [PTR, SIZE, PTR, SIZE], SIZE)
for name in ["decodeVertexBuffer", "decodeIndexBuffer", "decodeIndexSequence"]:
    bind(name, [PTR, SIZE, SIZE, PTR, SIZE], INT)
bind("encodeFilterExp", [PTR, SIZE, SIZE, INT, PTR, INT], None)
bind("encodeFilterOct", [PTR, SIZE, SIZE, INT, PTR], None)
bind("decodeFilterExp", [PTR, SIZE, SIZE], None)
bind("decodeFilterOct", [PTR, SIZE, SIZE], None)
bind("decodeFilterQuat", [PTR, SIZE, SIZE], None)


def read_glb(path):
    data = path.read_bytes()
    assert struct.unpack_from("<III", data) == (0x46546C67, 2, len(data)), path
    json_length, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A
    model = json.loads(data[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", data, binary_offset)
    assert binary_type == 0x004E4942
    return model, data[binary_offset + 8:binary_offset + 8 + binary_length], len(data)


def build_glb(model, binary):
    encoded = json.dumps(model, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    size = 12 + 8 + len(encoded) + 8 + len(binary)
    return (struct.pack("<IIIII", 0x46546C67, 2, size, len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def pointer(data):
    return (ctypes.c_ubyte * len(data)).from_buffer_copy(data)


def decode(data, count, stride, mode, filter_name=None):
    output = (ctypes.c_ubyte * (count * stride))()
    function = {"ATTRIBUTES": LIB.decodeVertexBuffer, "TRIANGLES": LIB.decodeIndexBuffer,
                "INDICES": LIB.decodeIndexSequence}[mode]
    assert function(output, count, stride, pointer(data), len(data)) == 0, "Meshopt decode failed"
    if filter_name:
        {"EXPONENTIAL": LIB.decodeFilterExp, "OCTAHEDRAL": LIB.decodeFilterOct,
         "QUATERNION": LIB.decodeFilterQuat}[filter_name](output, count, stride)
    return bytes(output)


def read_view(view, binary):
    extension = view.get("extensions", {}).get(EXTENSION)
    if extension:
        assert extension["buffer"] == 0
        offset = extension.get("byteOffset", 0)
        encoded = binary[offset:offset + extension["byteLength"]]
        return decode(encoded, extension["count"], extension["byteStride"],
                      extension["mode"], extension.get("filter"))
    assert view["buffer"] == 0
    offset = view.get("byteOffset", 0)
    return binary[offset:offset + view["byteLength"]]


def encode_attributes(raw, count, stride, bits=None):
    source = pointer(raw)
    filter_name = None
    if bits:
        filtered = (ctypes.c_ubyte * len(raw))()
        # Shared-vector exponent keeps tiny vector components stable relative
        # to the largest component. Decoding still returns glTF FLOAT values.
        LIB.encodeFilterExp(filtered, count, stride, bits, source, 1)
        source = filtered
        filter_name = "EXPONENTIAL"
    bound = LIB.encodeVertexBufferBound(count, stride)
    output = (ctypes.c_ubyte * bound)()
    size = LIB.encodeVertexBuffer(output, bound, source, count, stride)
    assert size > 0
    return bytes(output[:size]), filter_name


def encode_normals(raw, count):
    original = np.frombuffer(raw, dtype="<f4").reshape(count, 3)
    vectors = np.empty((count, 4), dtype=np.float32)
    vectors[:, :3] = original
    vectors[:, 3] = 0
    filtered = (ctypes.c_ubyte * (count * 8))()
    LIB.encodeFilterOct(filtered, count, 8, PRECISION["NORMAL"], vectors.ctypes.data_as(PTR))
    encoded, _ = encode_attributes(bytes(filtered), count, 8)
    return encoded, "OCTAHEDRAL"


def encode_indices(raw, accessor, mode):
    dtype = {5121: np.uint8, 5123: np.dtype("<u2"), 5125: np.dtype("<u4")}[accessor["componentType"]]
    values = np.ascontiguousarray(np.frombuffer(raw, dtype=dtype), dtype=np.uint32)
    count = len(values)
    vertex_count = int(values.max(initial=0)) + 1
    bound_function = LIB.encodeIndexBufferBound if mode == "TRIANGLES" else LIB.encodeIndexSequenceBound
    encode_function = LIB.encodeIndexBuffer if mode == "TRIANGLES" else LIB.encodeIndexSequence
    bound = bound_function(count, vertex_count)
    output = (ctypes.c_ubyte * bound)()
    size = encode_function(output, bound, values.ctypes.data_as(PTR), count)
    assert size > 0
    return bytes(output[:size])


def canonical_triangles(array):
    triangles = array.reshape(-1, 3)
    # Triangle compression can cyclically rotate vertices, preserving winding.
    start = np.argmin(triangles, axis=1)
    return np.take_along_axis(triangles, (np.arange(3)[None, :] + start[:, None]) % 3, axis=1)


def optimize(name):
    output_path = ROOT / "public/models" / f"{name}.glb"
    backup_path = ROOT / "design-source/model-archive" / f"{name}-native-precision.glb"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    if not backup_path.exists():
        shutil.copy2(output_path, backup_path)
    original, binary, before_bytes = read_glb(backup_path)
    model = copy.deepcopy(original)
    image_views = {image["bufferView"] for image in model.get("images", [])}
    semantics = {}
    indices_modes = {}
    for mesh in model["meshes"]:
        for primitive in mesh["primitives"]:
            for semantic, index in primitive["attributes"].items():
                semantics[index] = semantic
            if "indices" in primitive:
                indices_modes[primitive["indices"]] = "TRIANGLES" if primitive.get("mode", 4) == 4 else "INDICES"
    accessors_by_view = {}
    for index, accessor in enumerate(model["accessors"]):
        accessors_by_view.setdefault(accessor["bufferView"], []).append((index, accessor))
    raw_views = {index: read_view(view, binary) for index, view in enumerate(original["bufferViews"])}
    payload = bytearray()
    fallback_offset = 0
    errors = {key: 0.0 for key in PRECISION}
    position_precision_counts = {}
    normal_angle = 0.0
    geometry_bytes_before = 0
    geometry_bytes_after = 0
    vertex_count = 0
    unique_index_triangle_count = 0
    primitives = [primitive for mesh in model["meshes"] for primitive in mesh["primitives"]]
    primitive_triangle_count = sum(model["accessors"][primitive["indices"]]["count"] // 3
                                   for primitive in primitives if primitive.get("mode", 4) == 4)

    def append(data):
        payload.extend(b"\0" * (-len(payload) % 4))
        offset = len(payload)
        payload.extend(data)
        return offset

    for view_index, view in enumerate(model["bufferViews"]):
        raw = raw_views[view_index]
        if view_index in image_views:
            view["buffer"] = 0
            view["byteOffset"] = append(raw)
            view["byteLength"] = len(raw)
            view.get("extensions", {}).pop(EXTENSION, None)
            continue
        references = accessors_by_view.get(view_index, [])
        assert len(references) == 1, f"Expected independently packed view {view_index}: {references}"
        index, accessor = references[0]
        assert accessor.get("byteOffset", 0) == 0
        count = accessor["count"]
        stride = len(raw) // count
        assert count * stride == len(raw)
        semantic = semantics.get(index)
        mode = indices_modes.get(index, "ATTRIBUTES")
        filter_name = None
        if mode == "ATTRIBUTES":
            bits = PRECISION.get(semantic) if accessor["componentType"] == 5126 else None
            if semantic == "NORMAL" and bits:
                encoded, filter_name = encode_normals(raw, count)
                stride = 8
                accessor["componentType"] = 5122
                accessor["normalized"] = True
                view["byteStride"] = stride
            elif semantic == "TEXCOORD_0" and bits:
                uv = np.frombuffer(raw, dtype="<f4").reshape(count, 2)
                assert uv.min(initial=0) >= 0 and uv.max(initial=0) <= 1, "UVs must be in native atlas range"
                packed = np.round(uv * 65535).astype("<u2").tobytes()
                stride = 4
                encoded, filter_name = encode_attributes(packed, count, stride)
                accessor["componentType"] = 5123
                accessor["normalized"] = True
            elif semantic == "POSITION" and bits:
                position_values = np.frombuffer(raw, dtype="<f4")
                for actual_bits in range(13, bits + 1):
                    encoded, filter_name = encode_attributes(raw, count, stride, actual_bits)
                    decoded_position = np.frombuffer(decode(encoded, count, stride, mode, filter_name), dtype="<f4")
                    error = float(np.abs(position_values - decoded_position).max(initial=0))
                    if error <= 0.00005:
                        break
                assert error <= 0.00005
                position_precision_counts[str(actual_bits)] = position_precision_counts.get(str(actual_bits), 0) + 1
            else:
                encoded, filter_name = encode_attributes(raw, count, stride, bits)
            if semantic == "POSITION":
                vertex_count += count
        else:
            encoded = encode_indices(raw, accessor, mode)
            if mode == "TRIANGLES":
                unique_index_triangle_count += count // 3
        restored = decode(encoded, count, stride, mode, filter_name)
        if filter_name or (semantic == "TEXCOORD_0" and bits):
            if semantic == "NORMAL":
                values = np.frombuffer(raw, dtype="<f4").reshape(count, 3)
                decoded_values = np.frombuffer(restored, dtype="<i2").reshape(count, 4)[:, :3].astype(np.float64) / 32767
            elif semantic == "TEXCOORD_0":
                values = np.frombuffer(raw, dtype="<f4").reshape(count, 2)
                decoded_values = np.frombuffer(restored, dtype="<u2").reshape(count, 2).astype(np.float64) / 65535
            else:
                values = np.frombuffer(raw, dtype="<f4").reshape(count, stride // 4)
                decoded_values = np.frombuffer(restored, dtype="<f4").reshape(count, stride // 4)
            errors[semantic] = max(errors[semantic], float(np.abs(values - decoded_values).max(initial=0)))
            if semantic == "NORMAL":
                # atan2 cross/dot is stable for angles below float32 epsilon.
                first = values.astype(np.float64)
                second = decoded_values.astype(np.float64)
                angles = np.arctan2(np.linalg.norm(np.cross(first, second), axis=1),
                                    np.einsum("ij,ij->i", first, second))
                normal_angle = max(normal_angle, float(np.degrees(angles).max(initial=0)))
            if semantic == "POSITION":
                accessor["min"] = decoded_values.min(axis=0).tolist()
                accessor["max"] = decoded_values.max(axis=0).tolist()
        elif mode == "TRIANGLES":
            dtype = "<u2" if stride == 2 else "<u4"
            assert np.array_equal(canonical_triangles(np.frombuffer(raw, dtype=dtype)),
                                  canonical_triangles(np.frombuffer(restored, dtype=dtype)))
        else:
            assert raw == restored, f"Lossless attribute/index changed: {name} view {view_index}"
        extension = {"buffer": 0, "byteOffset": append(encoded), "byteLength": len(encoded),
                     "byteStride": stride, "count": count, "mode": mode}
        if filter_name:
            extension["filter"] = filter_name
        view["buffer"] = 1
        view["byteOffset"] = fallback_offset
        view["byteLength"] = len(restored)
        view.setdefault("extensions", {})[EXTENSION] = extension
        fallback_offset += len(restored)
        old_extension = original["bufferViews"][view_index].get("extensions", {}).get(EXTENSION)
        geometry_bytes_before += old_extension["byteLength"] if old_extension else len(raw)
        geometry_bytes_after += len(encoded)
    model["buffers"] = [{"byteLength": len(payload)}, {"byteLength": fallback_offset,
                         "extensions": {EXTENSION: {"fallback": True}}}]
    for key in ["extensionsUsed", "extensionsRequired"]:
        model.setdefault(key, [])
        for extension_name in [EXTENSION, "KHR_mesh_quantization"]:
            if extension_name not in model[key]:
                model[key].append(extension_name)
    assert errors["POSITION"] < 0.0001, errors
    assert errors["TEXCOORD_0"] < 0.0001, errors
    assert normal_angle < 0.1, normal_angle
    encoded_glb = build_glb(model, bytes(payload))
    assert len(encoded_glb) < before_bytes
    # Structural equality excludes the accessor bounds recalculated above.
    for key in ["meshes", "nodes", "scenes", "materials", "images", "textures", "samplers"]:
        assert model.get(key) == original.get(key), f"Authored structure changed: {key}"
    for image in model["images"]:
        index = image["bufferView"]
        before_image = read_view(original["bufferViews"][index], binary)
        after_image = read_view(model["bufferViews"][index], payload)
        assert hashlib.sha256(before_image).digest() == hashlib.sha256(after_image).digest()
    return output_path, encoded_glb, {
        "beforeBytes": before_bytes, "afterBytes": len(encoded_glb),
        "savedPercent": round((1 - len(encoded_glb) / before_bytes) * 100, 2),
        "geometryBeforeBytes": geometry_bytes_before, "geometryAfterBytes": geometry_bytes_after,
        "vertexCount": vertex_count, "triangleCount": primitive_triangle_count,
        "uniqueIndexBufferTriangleCount": unique_index_triangle_count,
        "meshDefinitions": len(model["meshes"]), "primitiveDefinitions": len(primitives),
        "maximumComponentError": errors, "maximumNormalAngleDegrees": normal_angle,
        "positionMantissaBitsByView": position_precision_counts,
        "embeddedTextureBytesPreserved": True,
    }


results = [optimize(name) for name in ["keshya", "botanicals"]]
total_before = sum(item[2]["beforeBytes"] for item in results)
total_after = sum(item[2]["afterBytes"] for item in results)
for path, data, metrics in results:
    temporary = path.with_suffix(".optimized.glb")
    temporary.write_bytes(data)
    temporary.replace(path)
    print(path.name, json.dumps(metrics))
manifest_path = ROOT / "public/models/ingredients-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["version"] = 3
manifest["compression"] = {
    "extension": EXTENSION,
    "attributes": "Adaptive 13–16-bit exponential positions (≤0.00005-unit component error); 12-bit octahedral normals; normalized 16-bit UVs; lossless colors and triangle connectivity",
    "precisionBits": {"POSITION": {"minimum": 13, "maximum": 16, "maximumComponentError": 0.00005}, "NORMAL": 12, "TEXCOORD_0": 16},
    "simplification": False,
    "textureResolutionChanged": False,
    "vertexAndTriangleOrderPreserved": True,
    "embeddedTextureBytesPreserved": True,
    "totalBeforeBytes": total_before,
    "totalAfterBytes": total_after,
    "triangleCounting": "triangleCount sums every glTF primitive index count; uniqueIndexBufferTriangleCount counts each stored index buffer once. Shared index buffers do not simplify or remove triangles.",
    "assets": {path.stem: metrics for path, _, metrics in results},
}
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Total: {total_before:,} -> {total_after:,} bytes ({(1 - total_after / total_before) * 100:.1f}% saved)")
