import { Mesh, type Object3D, type Material, type Texture, type BufferGeometry } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let bottleTemplate: Promise<GLTF> | undefined;

/** One download/decode, with independent transforms and GPU resources per viewer. */
export async function loadBottleScene(): Promise<Object3D> {
  bottleTemplate ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync('/models/keshya.glb?rev=3').catch(error => { bottleTemplate = undefined; throw error; });
  const template = await bottleTemplate;
  const clone = template.scene.clone(true);
  const geometries = new Map<BufferGeometry, BufferGeometry>();
  const materials = new Map<Material, Material>();
  const textures = new Map<Texture, Texture>();
  const cloneMaterial = (original: Material) => {
    let material = materials.get(original);
    if (material) return material;
    material = original.clone(); materials.set(original, material);
    const properties = material as unknown as Record<string, unknown>;
    Object.entries(properties).forEach(([key, value]) => {
      if (!value || typeof value !== 'object' || !('isTexture' in value)) return;
      const source = value as Texture;
      let texture = textures.get(source);
      if (!texture) {
        texture = source.clone(); texture.userData = { ...source.userData, sharedBitmap: true };
        textures.set(source, texture);
      }
      properties[key] = texture;
    });
    return material;
  };
  clone.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const original = object.geometry as BufferGeometry;
    let geometry = geometries.get(original);
    if (!geometry) { const copy: BufferGeometry = original.clone(); geometries.set(original, copy); geometry = copy; }
    object.geometry = geometry;
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  return clone;
}
