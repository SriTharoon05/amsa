"""Reference-matched AMSA product asset, authored in Blender.

Blender 5.2 --background --python scripts/create-realistic-bottle.py
Use -- --preview for a quick studio proof; default writes a 2000 x 2600 proof.
The 3.6-unit model is Z-up in Blender and Y-up / front +Z in the GLB.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'design-source'
TEXTURES = SOURCE / 'textures'
OUTPUT = ROOT / 'public' / 'models' / 'keshya.glb'
QUICK = '--preview' in sys.argv
EXPORT_ONLY = '--export-only' in sys.argv
TEXTURES.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj

def mat(name, color, roughness, transmission=0, ior=1.5, coat=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Transmission Weight'].default_value = transmission
    bsdf.inputs['IOR'].default_value = ior
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = .08
    return result

def volume(material, thickness, color, density):
    tree = material.node_tree
    absorption = tree.nodes.new('ShaderNodeVolumeAbsorption')
    absorption.inputs['Color'].default_value = (*color, 1)
    absorption.inputs['Density'].default_value = density
    tree.links.new(absorption.outputs[0], tree.nodes.get('Material Output').inputs['Volume'])
    settings = bpy.data.node_groups.get('glTF Material Output')
    if settings is None:
        settings = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        settings.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        settings.interface.new_socket(name='Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    gltf = tree.nodes.new('ShaderNodeGroup')
    gltf.node_tree = settings
    gltf.label = 'Physical glass thickness for the web renderer'
    gltf.inputs['Thickness'].default_value = thickness

glass = mat('AMSA thick amber glass | IOR 1.46', (.995, .65, .17), .047, 1.0, 1.46, .18)
volume(glass, .052, (.99, .42, .055), 1.2)
oil_material = mat('Keshya oil fill', (.995, .61, .11), .06, .93, 1.47)
volume(oil_material, .92, (.99, .53, .09), .90)
cap_material = mat('Polished black phenolic cap', (.004, .0045, .0055), .125, coat=.48)
paper = mat('Natural textured cotton paper label', (.91, .82, .63), .68)
paper.use_backface_culling = False

def lathe(name, profile, material, parent, segments=128):
    verts, faces, rings, uv = [], [], [], []
    z_min, z_max = min(z for r, z in profile), max(z for r, z in profile)
    for r, z in profile:
        if r == 0:
            rings.append([len(verts)])
            verts.append((0, 0, z))
            uv.append((.5, (z-z_min)/(z_max-z_min)))
        else:
            ring=[]
            for i in range(segments + 1):
                a=2*math.pi*i/segments
                ring.append(len(verts))
                verts.append((r*math.cos(a), r*math.sin(a), z))
                uv.append((i/segments, (z-z_min)/(z_max-z_min)))
            rings.append(ring)
    for a,b in zip(rings, rings[1:]):
        for i in range(segments):
            if len(a)==1: faces.append((a[0], b[i+1], b[i]))
            elif len(b)==1: faces.append((a[i], a[i+1], b[0]))
            else: faces.append((a[i], a[i+1], b[i+1], b[i]))
    mesh=bpy.data.meshes.new(name+' precision-turned mesh')
    mesh.from_pydata(verts,[],faces)
    mesh.materials.append(material)
    mesh.update()
    layer=mesh.uv_layers.new(name='Surface UV')
    for p in mesh.polygons:
        p.use_smooth=True
        for loop in p.loop_indices: layer.data[loop].uv=uv[mesh.loops[loop].vertex_index]
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    return obj

root=empty('KeshyaBottle')
root['asset_revision']='reference-realistic-v2'
root['reference']='Amber Keshya Hair Oil Bottle.png'
root['ingredient_count']=52

# A continuous outside / mouth / inside profile creates actual solid glass,
# including the curved shoulder, thick rolled heel, and concave internal floor.
outer=[
    (0,-1.79),(.22,-1.797),(.40,-1.8),(.467,-1.797),(.501,-1.782),
    (.526,-1.755),(.542,-1.717),(.548,-1.674),(.55,-1.615),
    (.55,-1.50),(.55,-.85),(.55,0),(.55,.54),(.549,.66),
    (.546,.705),(.539,.744),(.526,.782),(.503,.818),
    (.471,.849),(.424,.878),(.379,.903),(.340,.931),
    (.317,.952),(.310,.975),(.310,1.031),(.319,1.044),
    (.319,1.070),(.307,1.083),(.308,1.155),(.293,1.175),
    (.272,1.175),(.263,1.160),(.263,.983),(.282,.943),
    (.315,.921),(.363,.882),(.419,.846),(.459,.817),
    (.492,.777),(.511,.720),(.518,.647),(.519,-1.490),
    (.516,-1.555),(.505,-1.605),(.480,-1.643),(.442,-1.666),
    (.360,-1.674),(.24,-1.660),(0,-1.643)
]
body=lathe('BottleBody',outer,glass,root)
body['construction']='Hollow, thick-walled amber glass with rolled heel and molded shoulder'

# A visibly rounded liquid meniscus sits below the neck and belongs to the
# body so bottle animation remains a coherent assembly.
liquid_profile=[(0,-1.625),(.34,-1.650),(.45,-1.646),(.490,-1.61),
    (.506,-1.55),(.509,-1.48),(.509,.60),(.506,.69),(.495,.745),
    (.469,.786),(.431,.818),(.402,.824),(.394,.815),(.28,.813),(0,.813)]
liquid=lathe('BottleOilFill',liquid_profile,oil_material,body)
liquid['construction']='Separate golden oil volume with shallow meniscus'

# The supplied reference has an understated, glossy cap rather than the old
# deeply ribbed cap. Closely spaced profiles soften the top and bottom edges.
cap_profile=[(0,1.009),(.279,1.009),(.307,1.011),(.326,1.017),
    (.336,1.028),(.340,1.045),(.340,1.091),(.3395,1.105),
    (.340,1.118),(.340,1.705),(.3385,1.739),(.334,1.760),
    (.324,1.778),(.304,1.790),(.270,1.797),(.19,1.800),(0,1.800)]
cap=lathe('BottleCap',cap_profile,cap_material,root)
cap['construction']='Glossy black cap with softly rounded edges and subtle seal seam'
lathe('Cap seal lip',[(.336,1.045),(.341,1.049),(.341,1.057),(.337,1.061),(.336,1.045)],cap_material,cap)

label_path=TEXTURES/'keshya-label-v2.png'
if not label_path.exists():
    raise RuntimeError('Expected generated label texture at '+str(label_path))
label_image=bpy.data.images.load(str(label_path),check_existing=True)
label_image.colorspace_settings.name='sRGB'
label_image.pack()
# Encoding the supplied high resolution texture as JPEG keeps its native
# resolution, while the GLB remains suitable for a fast, animated webpage.
label_jpeg=TEXTURES/'keshya-label-v2.jpg'
scene=bpy.context.scene
label_copy=label_image.copy()
label_copy.scale(*label_image.size)
label_copy.filepath_raw=str(label_jpeg)
label_copy.file_format='JPEG'
label_copy.save(quality=94)
bpy.data.images.remove(label_copy)
label_image=bpy.data.images.load(str(label_jpeg),check_existing=False)
label_image.colorspace_settings.name='sRGB'
label_image.pack()
color_node=paper.node_tree.nodes.new('ShaderNodeTexImage')
color_node.name='High resolution AMSA label artwork'
color_node.image=label_image
paper.node_tree.links.new(color_node.outputs['Color'],paper.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

# A subtle, compact, genuinely procedural paper normal map also works in GLTF.
# Its microstructure is numerical texture generation, independent of artwork.
rng=np.random.default_rng(73)
size=256
height=rng.normal(0,1,(size,size)).astype(np.float32)
for _ in range(2): height=(height+np.roll(height,1,0)+np.roll(height,-1,0)+np.roll(height,1,1)+np.roll(height,-1,1))/5
dy,dx=np.gradient(height)
normal=np.stack([-dx*.20,-dy*.20,np.ones_like(height)],axis=2)
normal/=np.linalg.norm(normal,axis=2,keepdims=True)
rgba=np.concatenate([(normal*.5+.5),np.ones((size,size,1),dtype=np.float32)],axis=2).astype(np.float32)
normal_image=bpy.data.images.new('Cotton paper micrograin',width=size,height=size,alpha=False)
normal_image.colorspace_settings.name='Non-Color'
normal_image.pixels.foreach_set(rgba.ravel())
normal_image.file_format='PNG'
normal_image.filepath_raw=str(TEXTURES/'cotton-paper-normal.png')
normal_image.save()
grain=paper.node_tree.nodes.new('ShaderNodeTexImage')
grain.image=normal_image
mapping=paper.node_tree.nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value=(6,12,1)
coordinates=paper.node_tree.nodes.new('ShaderNodeTexCoord')
paper.node_tree.links.new(coordinates.outputs['UV'],mapping.inputs['Vector'])
paper.node_tree.links.new(mapping.outputs['Vector'],grain.inputs['Vector'])
normal_node=paper.node_tree.nodes.new('ShaderNodeNormalMap')
normal_node.inputs['Strength'].default_value=.28
paper.node_tree.links.new(grain.outputs['Color'],normal_node.inputs['Color'])
paper.node_tree.links.new(normal_node.outputs['Normal'],paper.node_tree.nodes.get('Principled BSDF').inputs['Normal'])

# A 2.02-unit-high paper arc, centered on -Y (web front +Z). The UV seam is
# outside the printed face; u reads left to right and v reads bottom to top.
verts,uv,faces=[],[],[]
columns,rows=96,12
for j in range(rows+1):
    v=j/rows
    z=-1.458+2.018*v
    for i in range(columns+1):
        u=i/columns
        angle=-math.pi/2+(-1.10+2.20*u)
        verts.append((.5535*math.cos(angle),.5535*math.sin(angle),z))
        uv.append((u,v))
for j in range(rows):
    for i in range(columns):
        a=j*(columns+1)+i
        faces.append((a,a+1,a+columns+2,a+columns+1))
label_mesh=bpy.data.meshes.new('Precision curved paper UV surface')
label_mesh.from_pydata(verts,[],faces)
label_mesh.materials.append(paper)
label_mesh.update()
layer=label_mesh.uv_layers.new(name='Label artwork UV')
for face in label_mesh.polygons:
    face.use_smooth=True
    for loop in face.loop_indices: layer.data[loop].uv=uv[label_mesh.loops[loop].vertex_index]
label=bpy.data.objects.new('BottleLabel',label_mesh)
bpy.context.collection.objects.link(label)
label.parent=root
label['construction']='High resolution artwork on a curved cotton-paper label'
label['formula_copy']='52 botanical ingredients'

# Export only the product, with physical glass extensions and embedded textures.
# Three's single transmission capture does not include nested transmissive
# objects. Its liquid uses opaque amber PBR under the true glass shell. The
# Blender source keeps the refractive liquid for the high quality studio proof.
oil_bsdf=oil_material.node_tree.nodes.get('Principled BSDF')
oil_bsdf.inputs['Base Color'].default_value=(.77,.315,.038,1)
oil_bsdf.inputs['Transmission Weight'].default_value=0
oil_bsdf.inputs['Roughness'].default_value=.16
oil_bsdf.inputs['Coat Weight'].default_value=.25
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for child in root.children_recursive: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,
    export_extras=True,export_yup=True,export_apply=False,export_texcoords=True,
    export_normals=True,export_materials='EXPORT',export_image_format='AUTO',
    export_image_quality=94,export_cameras=False,export_lights=False)
oil_bsdf.inputs['Base Color'].default_value=(.995,.61,.11,1)
oil_bsdf.inputs['Transmission Weight'].default_value=.93
oil_bsdf.inputs['Roughness'].default_value=.06
oil_bsdf.inputs['Coat Weight'].default_value=0
if EXPORT_ONLY:
    print('BOTTLE_EXPORT_ONLY',json.dumps({'bytes':OUTPUT.stat().st_size,'label_resolution':list(label_image.size)}))
    sys.exit(0)

# Studio reflections are explicit softboxes, producing clear vertical bands
# on the glass and cap similar to the user's high-end product reference.
world=bpy.data.worlds.new('Warm daylight studio')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.62,.66,.72,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.075
scene.world=world

def softbox(name,location,power,width,height,color=(1,1,1),target=(0,0,0)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.color=color
    data.shape='RECTANGLE'
    data.size=width
    data.size_y=height
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

softbox('Tall left silkbox',(-2.4,-3.0,1.0),220,.9,4.8,(1,.96,.88))
softbox('Tall right crisp strip',(2.6,-2.0,.3),150,.45,4.5,(1,.98,.93))
softbox('Rear left golden rim',(-2.2,1.7,1.1),280,.65,4.8,(1,.88,.61))
softbox('Rear right glass rim',(2.1,1.7,.8),270,.55,4.6,(1,.94,.79))
softbox('Front label silkbox',(0,-4.0,1.4),35,2.5,2.5,(1,.95,.84))
softbox('Top diffuser',(.1,.2,4.1),120,2.8,2.8,(1,.96,.87))

camera_data=bpy.data.cameras.new('Reference studio camera')
camera=bpy.data.objects.new('Reference studio camera',camera_data)
bpy.context.collection.objects.link(camera)
camera.location=(.08,-8,.32)
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=4.00
camera_data.lens=85
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=32 if QUICK else 128
scene.cycles.use_denoising=True
scene.cycles.max_bounces=12
scene.cycles.transmission_bounces=10
scene.cycles.glossy_bounces=6
scene.render.film_transparent=True
scene.render.resolution_x=1000 if QUICK else 2000
scene.render.resolution_y=1300 if QUICK else 2600
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=0
scene.render.filepath=str(SOURCE/('bottle-realistic-proof.png' if QUICK else 'bottle-realistic-preview.png'))

# Use a supported GPU when available; fall back to CPU without special setup.
try:
    preferences=bpy.context.preferences.addons['cycles'].preferences
    for backend in ('CUDA','HIP','ONEAPI','METAL'):
        try:
            preferences.compute_device_type=backend
            preferences.get_devices()
            devices=[device for device in preferences.devices if device.type!='CPU']
            if devices:
                for device in preferences.devices: device.use=device.type!='CPU'
                scene.cycles.device='GPU'
                break
        except Exception:
            continue
except Exception:
    pass
# The installed Windows CUDA driver is reliable for the small proof but fails
# with the larger transmission queue. CPU makes the final export reproducible.
if not QUICK:
    scene.cycles.device='CPU'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'bottle-realistic-v2.blend'))
bpy.ops.render.render(write_still=True)
triangles=sum(len(p.vertices)-2 for o in root.children_recursive if o.type=='MESH' for p in o.data.polygons)
print('BOTTLE_ASSET_REPORT',json.dumps({'bytes':OUTPUT.stat().st_size,'triangles':triangles,
    'label_resolution':list(label_image.size),'height':3.6,'diameter':1.107,'preview':scene.render.filepath,
    'source':str(SOURCE/'bottle-realistic-v2.blend')}))
