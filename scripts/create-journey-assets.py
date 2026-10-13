"""Reproducible, texture-free AMSA illustrative journey assets.

Run with Blender --background --python scripts/create-journey-assets.py.
Botanical shapes are decorative ingredient representations, not a verified
manufacturing process or a scientific specimen collection. Shared meshes keep
the GLBs small. Blender Z-up is exported as glTF Y-up, front facing +Z.
"""
import bpy, math, json, re, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'design-source'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
random.seed(42)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.45):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

amber = material('AMSA amber glass', (.34, .095, .018), .18, .17)
capmat = material('Gloss black ribbed cap', (.015, .013, .01), .2, .24)
cream = material('Natural cream paper', (.86, .77, .56), 0, .82)
ink = material('Earth brown printed ink', (.09, .04, .014), 0, .8)
gold = material('Warm gold emboss', (.66, .38, .08), .65, .28)
bronze = material('Brushed brass infusion bowl', (.31, .16, .058), .72, .3)
oilmat = material('Golden botanical oil', (.7, .33, .028), .2, .13)
green = material('Botanical forest green', (.08, .19, .042), 0, .6)
freshgreen = material('Fresh botanical green', (.18, .31, .055), 0, .58)
sage = material('Silvery sage green', (.22, .32, .19), 0, .67)
stemmat = material('Botanical stems', (.13, .13, .035), 0, .68)
rootmat = material('Earthy roots', (.3, .115, .047), 0, .72)
barkmat = material('Cinnamon bark', (.32, .09, .027), 0, .8)
seedmat = material('Sesame ivory', (.71, .54, .27), 0, .6)
blackseed = material('Black cumin seed', (.025, .027, .019), 0, .67)
brownseed = material('Deep brown seed', (.15, .053, .02), 0, .45)
almondmat = material('Almond copper skin', (.43, .18, .045), 0, .67)
whitepetal = material('Jasmine ivory petals', (.95, .87, .66), 0, .63)
pinkpetal = material('Rose blush petals', (.66, .12, .22), 0, .52)
redpetal = material('Hibiscus crimson', (.6, .022, .025), 0, .55)
purplepetal = material('Butterfly pea indigo', (.13, .035, .4), 0, .6)
lotusmat = material('Lotus soft rose', (.89, .36, .42), 0, .6)
yellow = material('Botanical gold', (.9, .53, .035), 0, .63)
orange = material('Citrus golden orange', (.77, .23, .015), 0, .65)
beetmat = material('Beet violet', (.22, .018, .045), 0, .52)
coconutmat = material('Coconut fibrous brown', (.18, .075, .027), 0, .83)
coconutwhite = material('Coconut white flesh', (.96, .91, .77), 0, .73)

def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    data.update()
    for poly in data.polygons:
        poly.use_smooth = True
    return data

def instance(name, data, parent=None, location=(0,0,0), scale=(1,1,1), rotation=(0,0,0), mat=None):
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    obj.rotation_euler = rotation
    if mat:
        # Material slots linked to the object preserve shared mesh geometry.
        obj.material_slots[0].link = 'OBJECT'
        obj.material_slots[0].material = mat
    return obj

def lathe(name, profile, mat, segments=48):
    vertices=[]
    for radius,z in profile:
        for i in range(segments):
            a = i*2*math.pi/segments
            vertices.append((radius*math.cos(a), radius*math.sin(a), z))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments):
            n=(i+1)%segments
            faces.append((j*segments+i,j*segments+n,(j+1)*segments+n,(j+1)*segments+i))
    faces.append(tuple(range(segments-1,-1,-1)))
    faces.append(tuple((len(profile)-1)*segments+i for i in range(segments)))
    return mesh(name, vertices, faces, mat)

def orb_mesh(name, mat, segments=12, rings=8):
    verts=[]
    for j in range(rings+1):
        a=math.pi*j/rings
        for i in range(segments):
            b=2*math.pi*i/segments
            verts.append((math.sin(a)*math.cos(b),math.sin(a)*math.sin(b),math.cos(a)))
    faces=[]
    for j in range(rings):
        for i in range(segments):
            n=(i+1)%segments
            faces.append((j*segments+i,j*segments+n,(j+1)*segments+n,(j+1)*segments+i))
    return mesh(name, verts, faces, mat)

def leaf_mesh(name, mat, petal=False):
    verts=[]
    steps=8
    for i in range(steps+1):
        t=i/steps
        width=(math.sin(math.pi*t)**(.65 if petal else .95))*(.47 if petal else .28)
        curl=.13*math.sin(math.pi*t)+.09*t*t
        verts.extend([(-width,t,curl-.055*math.sin(math.pi*t)),(0,t,curl),(width,t,curl-.055*math.sin(math.pi*t))])
    faces=[]
    for i in range(steps):
        for k in range(2):
            faces.append((i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k))
    # Two-sided leaves/petals so orbiting always shows the botanical.
    result=mesh(name,verts,faces,mat)
    mat.use_nodes=True
    mat.use_backface_culling=False
    return result

leaf=leaf_mesh('Shared curved lance leaf',green)
petal=leaf_mesh('Shared soft curled petal',pinkpetal,True)
sphere=orb_mesh('Shared botanical seed',seedmat)
stem=lathe('Shared botanical stem',[(.018,0),(.014,1)],stemmat,8)
rootdata=lathe('Shared tapered root',[(.075,0),(.065,.2),(.045,.55),(.013,.9),(.002,1)],rootmat,10)

def segment(name, parent, a, b, width=.02, mat=stemmat):
    delta=Vector(b)-Vector(a)
    obj=instance(name,stem,parent,a,(width/.018,width/.018,delta.length),mat=mat)
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return obj

# The bottle: a rounded, warm amber silhouette with a turned shoulder.
bottle=empty('KeshyaBottle')
bodydata=lathe('Rounded amber bottle',[(.35,-1.8),(.435,-1.785),(.477,-1.73),(.487,-1.65),(.487,.62),(.481,.72),(.455,.81),(.383,.93),(.29,1.04),(.267,1.09),(.267,1.27)],amber,64)
body=instance('BottleBody',bodydata,bottle)
capdata=lathe('Black ribbed cap shell',[(.27,1.17),(.291,1.2),(.291,1.73),(.275,1.8),(.05,1.8)],capmat,64)
cap=instance('BottleCap',capdata,bottle)
ribdata=lathe('Cap grip rib',[(.003,0),(.008,.017),(.008,.51),(.003,.53)],capmat,6)
for i in range(36):
    a=2*math.pi*i/36
    instance('Cap grip %02d'%i,ribdata,cap,(.289*math.cos(a),.289*math.sin(a),1.22))
instance('Cap lower gold ring',lathe('Cap slim trim',[(.29,1.184),(.293,1.19),(.293,1.212),(.29,1.218)],gold,64),cap)
instance('Bottle foot highlight',lathe('Glass foot rim',[(.48,-1.72),(.49,-1.7),(.49,-1.67),(.48,-1.65)],amber,64),body)

# One paper arc rather than a whole wrap keeps the front identifiable in motion.
labelverts=[]
segments=40
for z in [-1.42,.6]:
    for i in range(segments+1):
        a=-math.pi/2+(-1.08+2.16*i/segments)
        labelverts.append((.495*math.cos(a),.495*math.sin(a),z))
labelfaces=[(i,i+1,segments+2+i,segments+1+i) for i in range(segments)]
label=instance('BottleLabel',mesh('Curved natural label',labelverts,labelfaces,cream),bottle)
fontserif=bpy.data.fonts.load('C:/Windows/Fonts/georgia.ttf')
fontsans=bpy.data.fonts.load('C:/Windows/Fonts/arial.ttf')
def text(name,value,size,z,mat=ink,font=None):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=value
    curve.size=size
    curve.align_x='CENTER'
    curve.resolution_u=2
    curve.extrude=.0006
    curve.font=font or fontserif
    curve.materials.append(mat)
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.parent=label
    obj.location=(0,-.503,z)
    obj.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj
text('AMSA brand lettering','AMSA',.28,-.11)
text('AYURVEDIC lettering','A Y U R V E D I C',.058,-.24,font=fontsans)
text('Keshya lettering','Keshya',.18,-.65)
text('Hair Oil lettering','Hair Oil',.16,-.85)
text('Ingredients lettering','52 botanical ingredients',.049,-1.08,font=fontsans)
text('Volume lettering','100 ml',.065,-1.3,font=fontsans)
# Small gold lotus emblem above the wordmark.
for i,a in enumerate([-1.0,-.48,0,.48,1.0]):
    obj=instance('Lotus gold petal %d'%i,petal,label,(0,-.506,.19),(.13,.27,.12),mat=gold)
    obj.rotation_euler=(math.pi/2,a,0)
segment('Label gold rule',label,(-.29,-.506,-.4),(.29,-.506,-.4),.003,gold)
segment('Label bottom gold rule',label,(-.29,-.506,-1.17),(.29,-.506,-1.17),.002,gold)

# Ingredient illustrations. Families share meshes but have distinct arrangements.
ingredient_source=(ROOT/'lib'/'ingredients.ts').read_text(encoding='utf-8')
ingredient_array=re.search(r'export\s+const\s+ingredientNames\s*=\s*\[(.*?)\]\s*as\s+const',ingredient_source,re.S)
assert ingredient_array, 'ingredientNames array not found'
names=re.findall(r"'([^']+)'",ingredient_array.group(1))
assert len(names)==52 and len(set(names))==52, 'Expected 52 unique supplied ingredients'
assert names[0]=='Sesamum indicum' and names[-1]=='Cocos nucifera'
assert names.count('Hibiscus rosa-sinensis')==1
assert all('\n' not in name and name[0].isupper() for name in names)
families={}
def sprig(root,index,mat=green,rosemary=False):
    segment('Stem',root,(0,0,-.3),(0,0,.34),.012)
    for k in range(3 if not rosemary else 5):
        z=-.23+k*(.17 if not rosemary else .105)
        for side in [-1,1]:
            obj=instance('Curved leaf',leaf,root,(0,0,z),(.65 if not rosemary else .25,.3 if not rosemary else .24,.65),mat=mat)
            obj.rotation_euler=(math.pi/2,side*.7,side*math.pi/2)
    families[index]='leaf sprig'

def flower(root,index,mat=whitepetal,petals=6,layers=1):
    segment('Flower stem',root,(0,0,-.3),(0,0,-.015),.013)
    for layer in range(layers):
        for k in range(petals):
            a=k*2*math.pi/petals+layer*.3
            s=(.32-layer*.055)
            instance('Curved flower petal',petal,root,(0,0,.02+layer*.035),(s,s,.8),rotation=(.12+layer*.24,0,a),mat=mat)
    instance('Golden pollen heart',sphere,root,(0,0,.045),(.075,.075,.038),mat=yellow)
    families[index]='flower'

def seeds(root,index,mat=seedmat,count=7,almond=False):
    for k in range(count):
        a=k*2.399
        r=.09+.13*(k/count)
        s=.058 if not almond else .15
        instance('Organic seed',sphere,root,(math.cos(a)*r,math.sin(a)*r,(k%3-1)*.025),(s,s*.55,s*1.75),rotation=(.7,.4,a),mat=mat)
    families[index]='seed'

def roots(root,index,mat=rootmat):
    for k in range(4):
        a=k*2.4
        instance('Tapered root',rootdata,root,(math.cos(a)*.1,math.sin(a)*.1,-.27),(.65,.65,.55),rotation=(.1*math.cos(a),.35*math.sin(a),a),mat=mat)
    families[index]='root'

def berry(root,index,mat,amount=3):
    for k in range(amount):
        a=k*2.3
        instance('Botanical fruit',sphere,root,(math.cos(a)*.1,math.sin(a)*.1,0),(.17,.17,.17),mat=mat)
        instance('Calyx leaf',leaf,root,(math.cos(a)*.1,math.sin(a)*.1,.13),(.23,.14,.2),rotation=(0,0,a),mat=green)
    families[index]='fruit'

botanicals=[]
for i,name in enumerate(names,1):
    group=empty('Ingredient_%02d'%i)
    group['ingredient_id']=i
    group['ingredient_name']=name
    botanicals.append(group)
    if i in [1,2,3,10,29,30,37,47,48,50]:
        seeds(group,i,blackseed if i in [2,37,47] else brownseed if i in [3,50] else almondmat if i==29 else seedmat,count=3 if i==29 else 7,almond=i==29)
    elif i==4:
        droplet=lathe('Tocopherol illustrative oil drop',[(.008,-.22),(.13,-.18),(.18,-.04),(.14,.1),(.055,.22),(.001,.34)],oilmat,20)
        instance('Golden oil drop',droplet,group)
        families[i]='oil drop'
    elif i in [5,20,35,38,40,41]:
        roots(group,i)
    elif i in [6,7,8,14,15,17,19,21,22,26,43,46]:
        mat={6:yellow,7:whitepetal,8:pinkpetal,14:whitepetal,15:yellow,17:whitepetal,19:whitepetal,21:yellow,22:lotusmat,26:redpetal,43:yellow,46:purplepetal}[i]
        flower(group,i,mat,petals=5 if i in [26,46] else 8,layers=3 if i in [8,22] else 1)
        if i==26:
            segment('Hibiscus stamen',group,(0,0,.04),(.025,0,.25),.012,yellow)
            instance('Stamen tip',sphere,group,(.025,0,.26),(.035,.025,.025),mat=yellow)
    elif i==18:
        roll=lathe('Hollow cinnamon curl',[(.035,-.26),(.064,-.26),(.068,.26),(.038,.26),(.035,-.26)],barkmat,14)
        for k in range(3):
            instance('Cinnamon quill',roll,group,((k-1)*.12,0,0),rotation=(.18*k,.25*(k-1),0))
        families[i]='bark'
    elif i==49:
        for k in range(4):
            a=k*1.7
            location=(.1*math.cos(a),.1*math.sin(a),-.15)
            instance('Clove stem',rootdata,group,location,(.5,.5,.3),mat=brownseed)
            instance('Clove bud',sphere,group,(location[0],location[1],.1),(.054,.054,.044),mat=brownseed)
        families[i]='spice bud'
    elif i==16:
        berry(group,i,freshgreen)
    elif i==32:
        instance('Chilli pepper',rootdata,group,(0,0,-.3),(2,2,.7),rotation=(.15,.15,0),mat=redpetal)
        segment('Chilli stalk',group,(0,0,-.3),(0,0,-.39),.02,green)
        families[i]='fruit'
    elif i==33:
        seeds(group,i,brownseed,count=4,almond=True)
        families[i]='coffee bean'
    elif i==42:
        instance('Beetroot',sphere,group,(0,0,-.08),(.23,.23,.25),mat=beetmat)
        instance('Beet taproot',rootdata,group,(0,0,-.19),(.4,.4,.25),rotation=(math.pi,0,0),mat=beetmat)
        for k in range(3):
            instance('Beet greens',leaf,group,(0,0,.12),(.35,.25,.6),rotation=(math.pi/2,.25*(k-1),k*2.1),mat=green)
        families[i]='root vegetable'
    elif i==44:
        instance('Carrot root',rootdata,group,(0,0,.2),(1.8,1.8,.58),rotation=(math.pi,0,0),mat=orange)
        for k in range(3):
            instance('Carrot greens',leaf,group,(0,0,.16),(.16,.2,.2),rotation=(math.pi/2,.2*(k-1),k*2.1),mat=green)
        families[i]='root vegetable'
    elif i==51:
        berry(group,i,orange,1)
    elif i==52:
        shell=lathe('Coconut half shell',[(.005,-.22),(.16,-.2),(.28,-.12),(.34,.025),(.35,.08),(.32,.09),(.3,.01),(.23,-.08),(.12,-.12),(.005,-.13)],coconutmat,24)
        flesh=lathe('Coconut flesh rim',[(.315,.015),(.328,.065),(.305,.085),(.282,.05),(.265,-.035),(.2,-.08),(.105,-.107),(.01,-.11)],coconutwhite,24)
        instance('Coconut husk',shell,group)
        instance('Coconut flesh',flesh,group)
        families[i]='coconut'
    elif i==24:
        for k in range(3):
            obj=instance('Aloe blade',leaf,group,(0,0,-.3),(.5,.6,1.4),rotation=(math.pi/2,.3*(k-1),k*2.1),mat=freshgreen)
        families[i]='succulent'
    else:
        sprig(group,i,sage if i in [23,34] else freshgreen if i in [25,31] else green,rosemary=i in [23,36])
    group['family']=families[i]

vessel=empty('Vessel')
vesseldata=lathe('Turned brass infusion bowl',[(.09,-.27),(.5,-.27),(.92,-.18),(1.25,.02),(1.47,.22),(1.5,.28),(1.48,.33),(1.4,.3),(1.35,.22),(1.18,.07),(.87,-.095),(.47,-.17),(.09,-.18)],bronze,64)
instance('Brass bowl body',vesseldata,vessel)
oil=instance('Oil',lathe('Oil liquid disc',[(.005,0),(1.345,0),(1.35,.02),(.005,.02)],oilmat,64))

# Merge each moving illustration into one mesh with a few material primitives.
# Reuse identical completed meshes across specimens; avoid hundreds of tiny
# draw calls while retaining the independently addressable ingredient roots.
consolidated={}
def consolidate(root):
    bpy.context.view_layer.update()
    objects=([root] if root.type=='MESH' else [])+[o for o in root.children_recursive if o.type=='MESH']
    vertices=[]
    faces=[]
    materials=[]
    face_materials=[]
    smooth=[]
    for obj in objects:
        matrix=root.matrix_world.inverted() @ obj.matrix_world
        offset=len(vertices)
        vertices.extend(tuple(matrix @ v.co) for v in obj.data.vertices)
        for poly in obj.data.polygons:
            mat=obj.material_slots[poly.material_index].material
            if mat not in materials:
                materials.append(mat)
            faces.append(tuple(offset+i for i in poly.vertices))
            face_materials.append(materials.index(mat))
            smooth.append(poly.use_smooth)
    if root.name.startswith('Ingredient_'):
        lo=Vector(tuple(min(p[a] for p in vertices) for a in range(3)))
        hi=Vector(tuple(max(p[a] for p in vertices) for a in range(3)))
        center=(lo+hi)*.5
        factor=.62/max(hi[a]-lo[a] for a in range(3))
        vertices=[tuple((Vector(p)-center)*factor) for p in vertices]
    signature=(tuple(tuple(round(v,5) for v in p) for p in vertices),tuple(faces),tuple(m.name for m in materials),tuple(face_materials))
    if signature in consolidated:
        data=consolidated[signature]
    else:
        data=bpy.data.meshes.new(root.name+' optimized geometry')
        data.from_pydata(vertices,[],faces)
        for mat in materials:
            data.materials.append(mat)
        for poly,mi,sm in zip(data.polygons,face_materials,smooth):
            poly.material_index=mi
            poly.use_smooth=sm
        data.update()
        consolidated[signature]=data
    for obj in objects:
        if obj!=root:
            bpy.data.objects.remove(obj,do_unlink=True)
    if root.type=='MESH':
        root.data=data
        for slot in root.material_slots:
            slot.link='DATA'
    else:
        instance(root.name+' geometry',data,root)
for root in [body,cap,label]+botanicals+[vessel]:
    consolidate(root)

def select_roots(roots):
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for obj in root.children_recursive:
            obj.select_set(True)

def export(path,roots):
    select_roots(roots)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=False,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)

export(OUT/'keshya.glb',[bottle])
export(OUT/'botanicals.glb',botanicals+[vessel,oil])
(OUT/'ingredients-manifest.json').write_text(json.dumps({'version':1,'assets':{'product':'/models/keshya.glb','botanicals':'/models/botanicals.glb'},'note':'Artistic botanical representations supplied for an illustrative ingredient-to-oil story.','entries':[{'id':i,'name':name,'node':'Ingredient_%02d'%i,'family':families[i]} for i,name in enumerate(names,1)]},indent=2),encoding='utf-8')

# A real Blender source plus a studio render for visual review, excluded from deploy.
for i,group in enumerate(botanicals):
    col=i%13
    row=i//13
    group.location=(col*.78-4.68,2.4+row*.95,-1.39)
    group.rotation_euler=(0,0,random.uniform(-.8,.8))
vessel.location=(-2.15,-.15,-1.5)
oil.location=(-2.15,-.15,-1.29)
bottle.location=(1.55,-.4,0)
studio=material('Studio warm ivory',(.71,.65,.51),0,.85)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.82))
floor=bpy.context.object
floor.name='Preview studio floor'
floor.data.materials.append(studio)
def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large warm studio key',(-3,-4,7),1100,5)
area('Product rim',(4,2,5),900,3)
area('Front soft fill',(3,-5,2),350,3)
camera_data=bpy.data.cameras.new('Preview Camera')
camera=bpy.data.objects.new('Preview Camera',camera_data)
bpy.context.collection.objects.link(camera)
camera.location=(7,-11,9)
camera.rotation_euler=(Vector((0,1.3,-.2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=13.8
scene=bpy.context.scene
scene.camera=camera
scene.world.color=(.25,.25,.25)
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(SOURCE/'journey-assets-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'amsa-journey.blend'))
bpy.ops.render.render(write_still=True)

for root in botanicals+[vessel,oil]:
    root.hide_render=True
    for obj in root.children_recursive:
        obj.hide_render=True
bottle.location=(0,0,0)
camera.location=(2.6,-7,1.7)
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=4.6
scene.render.resolution_x=1000
scene.render.resolution_y=1100
scene.cycles.samples=16
scene.render.filepath=str(SOURCE/'bottle-preview.png')
bpy.ops.render.render(write_still=True)

print('ASSET_REPORT',json.dumps({'product_bytes':(OUT/'keshya.glb').stat().st_size,'botanical_bytes':(OUT/'botanicals.glb').stat().st_size,'ingredients':len(botanicals),'bottle_bounds_blender':{'height':3.6,'diameter':.99},'preview':str(SOURCE/'journey-assets-preview.png')}))
