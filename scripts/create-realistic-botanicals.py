"""Build AMSA's textured, sculpted botanical collection in Blender.

The supplied names are parsed only from ingredientNames, and every specimen is
independently addressable. Geometry uses curved surfaces, tapered stems, curled
petals, seed sutures and irregular root fibers rather than interchangeable icons.
The photographs in one shared 3x3 texture atlas supply surface detail. These are
art-directed representations, not a claim about the part/extraction of a formula.

Botanical morphology references used for the less familiar specimens:
https://www.nparks.gov.sg/florafaunaweb/flora/3/0/3030 (Mimusops flower)
https://powo.science.kew.org/taxon/463202-1 (Cassytha)
https://www.worldfloraonline.org/taxon/wfo-0000589782 (Cassytha filament)

Run: Blender --background --python scripts/create-realistic-botanicals.py
Optional env AMSA_RENDER_SAMPLES / AMSA_SKIP_RENDER control source previews.
"""
import bpy, math, json, re, random, os, ctypes
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'design-source'
TEXTURES = SOURCE / 'textures'
ATLAS_PATH = TEXTURES / 'botanical-atlas-v2.png'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
TEXTURES.mkdir(parents=True, exist_ok=True)
random.seed(483)
PI = math.pi
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Atlas order is image top-to-bottom, left-to-right. UV V is bottom-to-top.
LEAF, OLIVE, CRIMSON, IVORY, ROSE, BARK, HUSK, PALE_SEED, ROOT_FIBER = range(9)
DARK_SEED = ROOT_FIBER

def atlas_uv(tile, u, v):
    column = tile % 3
    row = tile // 3
    # The margin keeps mipmaps from sampling a neighboring surface.
    return ((column + .022 + .956*u)/3, (2-row + .022 + .956*v)/3)

def plain_material(name, color, roughness=.6, metallic=0, coat=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = .12
    material.use_backface_culling = False
    return material

atlas_image = None
if ATLAS_PATH.exists():
    atlas_image = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    atlas_image.colorspace_settings.name = 'sRGB'
    atlas_image.pack()

organic = plain_material('Shared photographic botanical atlas', (.3,.32,.14), .59, coat=.065)
organic.node_tree.nodes.clear()
nodes = organic.node_tree.nodes
links = organic.node_tree.links
output = nodes.new('ShaderNodeOutputMaterial')
shader = nodes.new('ShaderNodeBsdfPrincipled')
shader.inputs['Roughness'].default_value = .59
shader.inputs['Coat Weight'].default_value = .065
shader.inputs['Subsurface Weight'].default_value = .035
shader.inputs['Subsurface Radius'].default_value = (.12,.09,.04)
links.new(shader.outputs['BSDF'], output.inputs['Surface'])
color = nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
if atlas_image:
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = atlas_image
    texture.interpolation = 'Linear'
    texture.extension = 'EXTEND'
    multiply = nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    links.new(texture.outputs['Color'], multiply.inputs[1])
    links.new(color.outputs['Color'], multiply.inputs[2])
    links.new(multiply.outputs['Color'], shader.inputs['Base Color'])
    # Derive one full-native-resolution tangent normal field for leaf veins,
    # petal fibers, bark and husk. The original photograph stays untouched.
    width,height=atlas_image.size
    pixels=np.array(atlas_image.pixels[:],dtype=np.float32).reshape(height,width,4)
    luminance=np.sum(pixels[:,:,:3]*np.array([.2126,.7152,.0722],dtype=np.float32),axis=2)
    luminance=(luminance*4+np.roll(luminance,1,0)+np.roll(luminance,-1,0)+np.roll(luminance,1,1)+np.roll(luminance,-1,1))/8
    dy,dx=np.gradient(luminance)
    normals=np.stack((-dx*5.5,-dy*5.5,np.ones_like(dx)),axis=2)
    normals/=np.linalg.norm(normals,axis=2,keepdims=True)
    normal_pixels=np.concatenate((normals*.5+.5,np.ones((height,width,1),dtype=np.float32)),axis=2)
    normal_image=bpy.data.images.new('Shared botanical microstructure normal',width=width,height=height,alpha=False)
    normal_image.colorspace_settings.name='Non-Color'
    normal_image.pixels.foreach_set(normal_pixels.ravel())
    normal_image.filepath_raw=str(TEXTURES/'botanical-atlas-normal-v2.png')
    normal_image.file_format='PNG';normal_image.save();normal_image.pack()
    normal_texture=nodes.new('ShaderNodeTexImage');normal_texture.image=normal_image
    normal_texture.interpolation='Linear';normal_texture.extension='EXTEND'
    normal_node=nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.72
    links.new(normal_texture.outputs['Color'],normal_node.inputs['Color'])
    links.new(normal_node.outputs['Normal'],shader.inputs['Normal'])
else:
    links.new(color.outputs['Color'], shader.inputs['Base Color'])

def organic_variant(name,roughness,coat):
    material=organic.copy();material.name=name
    bsdf=next(node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Coat Weight'].default_value=coat
    return material
dry_organic=organic_variant('Rough dry botanical surfaces',.86,0)
petal_organic=organic_variant('Soft botanical petal surfaces',.69,.025)
leaf_organic=organic_variant('Natural waxy leaf surfaces',.49,.09)
flesh_organic=organic_variant('Fresh coconut endosperm',.63,.035)
flesh_shader=next(node for node in flesh_organic.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
for link in list(flesh_organic.node_tree.links):
    if link.to_socket==flesh_shader.inputs['Base Color']:flesh_organic.node_tree.links.remove(link)
flesh_shader.inputs['Base Color'].default_value=(.96,.93,.84,1)
flesh_normal=next((node for node in flesh_organic.node_tree.nodes if node.type=='NORMAL_MAP'),None)
if flesh_normal:flesh_normal.inputs['Strength'].default_value=.24

brass = plain_material('Satin hand-turned brass', (.48,.28,.09), .27, .83, .22)
brass_detail = plain_material('Brass recessed lathe bands', (.30,.17,.054), .42, .78)
oil_material = plain_material('Clear golden botanical oil', (.66,.31,.055), .075, 0, .4)
oil_shader = oil_material.node_tree.nodes.get('Principled BSDF')
oil_shader.inputs['Transmission Weight'].default_value = .34
oil_shader.inputs['IOR'].default_value = 1.47

def empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj

class Builder:
    def __init__(self):
        self.vertices=[]; self.faces=[]; self.uvs=[]; self.colors=[]; self.slots=[]
    def vertex(self, position, tile=LEAF, uv=(.5,.5), color=(1,1,1)):
        self.vertices.append(tuple(position))
        self.uvs.append(atlas_uv(tile, *uv))
        self.colors.append((*color, 1))
        return len(self.vertices)-1
    def face(self, indices, material=0):
        self.faces.append(tuple(indices)); self.slots.append(material)
    def build(self, name, materials=None, normalize=True):
        vertices = self.vertices
        if normalize:
            lo = Vector(tuple(min(p[a] for p in vertices) for a in range(3)))
            hi = Vector(tuple(max(p[a] for p in vertices) for a in range(3)))
            center = (lo+hi)/2
            factor = .62 / max(hi[a]-lo[a] for a in range(3))
            vertices = [tuple((Vector(p)-center)*factor) for p in vertices]
        data = bpy.data.meshes.new(name+' sculpture')
        data.from_pydata(vertices, [], self.faces)
        for material in materials or [organic]: data.materials.append(material)
        data.update()
        uv = data.uv_layers.new(name='UVMap')
        colors = data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for poly, slot in zip(data.polygons, self.slots):
            poly.use_smooth=True
            poly.material_index=slot
            for loop in poly.loop_indices:
                index = data.loops[loop].vertex_index
                uv.data[loop].uv=self.uvs[index]
                colors.data[loop].color=self.colors[index]
        data.color_attributes.active_color=colors
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        return obj

def transform(point, origin=(0,0,0), rotation=(0,0,0)):
    return Euler(rotation).to_matrix() @ Vector(point) + Vector(origin)

def tube(builder, points, radius=.008, tile=BARK, color=(.72,.65,.5), sides=6, end_radius=None):
    offset=len(builder.vertices)
    points=[Vector(point) for point in points]
    for j, point in enumerate(points):
        tangent=points[min(j+1,len(points)-1)]-points[max(0,j-1)]
        if tangent.length<.00001: tangent=Vector((0,0,1))
        tangent.normalize()
        ref=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((0,1,0))
        x=tangent.cross(ref).normalized(); y=tangent.cross(x).normalized()
        t=j/(len(points)-1)
        r=radius*(1-t)+(end_radius if end_radius is not None else radius*.62)*t
        for k in range(sides):
            a=2*PI*k/sides
            rib=1+.08*math.sin(a*3+j*.6)
            builder.vertex(point+(x*math.cos(a)+y*math.sin(a))*r*rib, tile, (k/sides,t), color)
    for j in range(len(points)-1):
        for k in range(sides):
            n=(k+1)%sides
            builder.face((offset+j*sides+k,offset+j*sides+n,offset+(j+1)*sides+n,offset+(j+1)*sides+k))
    builder.face(tuple(offset+k for k in range(sides-1,-1,-1)))
    builder.face(tuple(offset+(len(points)-1)*sides+k for k in range(sides)))

def ellipsoid(builder, center, scale, tile=PALE_SEED, color=(1,1,1), segments=18, rings=10,
              rotation=(0,0,0), wrinkle=0, seam=0, lobes=0, pointed=0):
    offset=len(builder.vertices)
    for j in range(rings+1):
        t=j/rings; theta=PI*t
        for k in range(segments+1):
            u=k/segments; phi=2*PI*u
            wave=1+wrinkle*(math.sin(phi*7+theta*8)*.45+math.sin(theta*18+phi*3)*.35)
            wave*=1+(math.cos(phi*lobes)*.035 if lobes else 0)
            s=math.sin(theta)
            # The broad coffee/seed suture is actual recessed geometry.
            groove=seam*math.exp(-(math.sin(phi)/.14)**2)*s**.65 if math.cos(phi)<0 else 0
            x=s*math.cos(phi)*(1-groove)*scale[0]*wave
            y=s*math.sin(phi)*scale[1]*wave
            z=math.cos(theta)*scale[2]*(1+pointed*(1-t)*.1)
            shade=.89+.11*math.sin(theta)**.4
            builder.vertex(transform((x,y,z),center,rotation),tile,(u,t),tuple(c*shade for c in color))
    for j in range(rings):
        for k in range(segments):
            a=offset+j*(segments+1)+k; b=a+segments+1
            builder.face((a,a+1,b+1,b))

def leaf(builder, origin=(0,0,0), length=.3, width=.09, rotation=(0,0,0), shape='ovate',
         serration=.04, curl=.035, tile=LEAF, tint=(.8,.9,.7), steps=14, ribs=True):
    offset=len(builder.vertices); across=4
    def profile(t):
        if shape=='heart': return math.sin(PI*t)**.56*(1-.45*t)
        if shape=='needle': return math.sin(PI*t)**.22*(1-.25*t)
        if shape=='lance': return math.sin(PI*t)**1.12
        if shape=='aloe': return math.sin(PI*t)**.6*(1-.65*t)
        if shape=='lobed': return math.sin(PI*t)**.6*(.68+.32*math.sin(PI*t*3)**2)
        return math.sin(PI*t)**.72*(1-.32*t)
    def center(t): return (0,t*length,curl*(math.sin(PI*t)*.55+t*t))
    for j in range(steps+1):
        t=j/steps
        span=width*profile(t)*(1+serration*math.cos(j*PI))
        for k in range(across+1):
            q=k/across*2-1
            fold=curl*(math.sin(PI*t)*(.55-.72*abs(q)**1.2)+t*t)
            fold+=.009*math.sin(t*PI*3+q*2)*abs(q)*math.sin(PI*t)
            p=(span*q,t*length,fold)
            shade=.84+.16*(1-abs(q))-.04*math.cos(j*1.7)
            builder.vertex(transform(p,origin,rotation),tile,(k/across,t),tuple(c*shade for c in tint))
    for j in range(steps):
        for k in range(across):
            a=offset+j*(across+1)+k; b=a+across+1
            builder.face((a,a+1,b+1,b))
    if ribs:
        points=[transform(center(.08+.86*j/7),origin,rotation) for j in range(8)]
        tube(builder,points,.0017,tile=OLIVE,color=(.68,.78,.36),sides=4,end_radius=.00055)
        for t in [.27,.46,.65,.81]:
            span=width*profile(t)*.75
            for side in [-1,1]:
                base=center(t-.035)
                end=(span*side,(t+.055)*length,curl*(math.sin(PI*t)*.09+t*t)+.0009)
                tube(builder,[transform(base,origin,rotation),transform(end,origin,rotation)],.00065,
                     tile=OLIVE,color=(.75,.84,.48),sides=3,end_radius=.00015)

def petal(builder, origin=(0,0,0), length=.27, width=.16, rotation=(0,0,0), curl=.09,
          tile=IVORY, tint=(1,1,1), steps=15, ripples=.006, pointed=.5):
    offset=len(builder.vertices); across=6
    for j in range(steps+1):
        t=j/steps
        span=width*math.sin(PI*t)**pointed
        for k in range(across+1):
            q=k/across*2-1
            z=curl*(.34*math.sin(PI*t)+t*t)-curl*.5*abs(q)**1.7*math.sin(PI*t)
            z+=ripples*math.sin(q*PI*3+t*6)*t*abs(q)
            z+=.012*math.sin(t*PI*2+q)*t
            shade=.88+.12*math.sin(PI*t)-.035*abs(q)
            builder.vertex(transform((span*q,t*length,z),origin,rotation),tile,(k/across,t),tuple(c*shade for c in tint))
    for j in range(steps):
        for k in range(across):
            a=offset+j*(across+1)+k; b=a+across+1
            builder.face((a,a+1,b+1,b))

def stem(builder, height=.55):
    tube(builder,[(.024*math.sin(j*.6),.009*math.cos(j),-.3+j*height/7) for j in range(8)],
         .007, tile=BARK, color=(.7,.73,.55),sides=6,end_radius=.004)

def sprig(builder, count=6, shape='ovate', serration=.05, width=.1, length=.26,
          tint=(.75,.96,.72), kind='opposite', tile=LEAF):
    stem(builder)
    pairs=max(2,count//2)
    for j in range(count):
        side=-1 if j%2 else 1
        z=-.23+(j//2)*.40/(pairs-1)
        if kind=='alternate': z+=.026*(j%2)
        base=(.01*math.sin(j),0,z)
        branch=(side*.04,-.009,z+.019)
        tube(builder,[base,branch],.003,tile=BARK,color=(.62,.69,.4),sides=5)
        rotation=(PI/2-.18+random.uniform(-.16,.16),side*.97+random.uniform(-.10,.10),random.uniform(-.08,.08))
        leaf(builder,branch,length*(.83+random.random()*.25),width,rotation,shape,serration,.032,tile,tint)
    leaf(builder,(0,0,.21),length*.62,width*.58,(PI/2-.24,0,.16),shape,serration,.03,tile,tint)

def rosemary(builder):
    stem(builder,.60)
    for j in range(13):
        z=-.27+j*.043
        for side in [-1,1]:
            rotation=(PI/2-.22,side*1.12,math.sin(j)*.09)
            leaf(builder,(0,0,z),.17-j*.003,.012,rotation,'needle',0,.012,OLIVE,(.66,.82,.68),steps=8,ribs=False)

def seeds(builder, tile, color, count=6, scale=(.057,.038,.09), seam=0, wrinkle=.04, angular=False):
    for j in range(count):
        a=j*2.399; r=.07+.065*(j/max(count-1,1))
        ellipsoid(builder,(math.cos(a)*r,math.sin(a)*r,.015*math.sin(j*2)),scale,tile,color,
                  segments=12 if angular else 18,rings=7 if angular else 10,
                  rotation=(.3+j*.39,.55+j*.16,a),wrinkle=wrinkle,seam=seam,pointed=.7)

def roots(builder, color=(.91,.73,.53), fibrous=False, reddish=False):
    amount=11 if fibrous else 4
    for k in range(amount):
        angle=k*2.399
        x=math.cos(angle)*.12; y=math.sin(angle)*.06
        points=[]
        for j in range(9):
            t=j/8
            points.append((x+.05*math.sin(j*.7+k),y+.025*math.cos(j*1.1+k),-.26+t*.54))
        radius=.007 if fibrous else .024+random.random()*.012
        tube(builder,points,radius,tile=ROOT_FIBER,color=color,sides=7,end_radius=.0018 if fibrous else .009)
        if not fibrous:
            for j in [2,5,7]:
                base=points[j]
                side=-1 if j%2 else 1
                end=(base[0]+side*(.035+random.random()*.03),base[1]+.025,base[2]-.07)
                tube(builder,[base,((base[0]+end[0])/2,base[1]+.018,base[2]-.018),end],.006,
                     tile=ROOT_FIBER,color=color,sides=5,end_radius=.0009)

def flower_base(builder, height=.21, leaves=True):
    tube(builder,[(0,0,-.32),(.007,.01,-.12),(0,0,height)],.007,tile=BARK,color=(.58,.69,.35),sides=6)
    if leaves:
        leaf(builder,(0,0,-.19),.19,.048,(PI/2,-.6,-PI/2),'lance',.055,.025,tint=(.65,.82,.55),steps=10)
    for j in range(5):
        leaf(builder,(0,0,height-.015),.06,.013,(.35,0,j*2*PI/5),'lance',0,.012,tint=(.65,.81,.44),steps=6,ribs=False)

def pollen(builder, center=(0,0,.2), radius=.064, height=.043, color=(1,.7,.11), count=31):
    ellipsoid(builder,center,(radius,radius,height),IVORY,color,segments=18,rings=8,wrinkle=.05)
    for j in range(count):
        a=j*2.399; r=radius*math.sqrt((j+.5)/count)*.93
        z=center[2]+height*math.sqrt(max(0,1-(r/radius)**2))
        ellipsoid(builder,(center[0]+math.cos(a)*r,center[1]+math.sin(a)*r,z),(.005,.005,.007),
                  IVORY,(1,.75,.16),segments=6,rings=4)

def daisy(builder, petals=19, tint=(1,.98,.87), yellow_center=True, narrow=True):
    flower_base(builder,.13)
    for j in range(petals):
        a=j*2*PI/petals
        petal(builder,(0,0,.14),.26+random.uniform(-.022,.02),.027 if narrow else .047,
              (.04+random.uniform(-.12,.08),0,a),-.045,IVORY,tint,steps=11,ripples=.004,pointed=.44)
    pollen(builder,(0,0,.155),.061,.07 if yellow_center else .035,(1,.72,.06) if yellow_center else (.9,.85,.6))

def jasmine(builder, mimusops=False):
    flower_base(builder,.06)
    count=24 if mimusops else 7
    for j in range(count):
        petal(builder,(0,0,.07),.24 if not mimusops else .20,.055 if not mimusops else .019,
              (.06,0,j*2*PI/count),.019,IVORY,(1,1,.94),steps=10,ripples=.002,pointed=.85)
    ellipsoid(builder,(0,0,.078),(.035,.035,.029),IVORY,(.88,.77,.4),segments=14,rings=7)

def rose(builder):
    flower_base(builder,.025)
    for layer, count in enumerate([9,8,7,6,5]):
        radius=.012+layer*.023
        for j in range(count):
            a=j*2*PI/count+layer*.71
            length=.29-layer*.031
            petal(builder,(math.sin(a)*radius*.13,-math.cos(a)*radius*.13,.03+layer*.027),
                  length,.14-layer*.013,(.19+layer*.14,0,a),.13,ROSE,(1,.91,.94),
                  steps=22,ripples=.006,pointed=.38)

def hibiscus(builder):
    flower_base(builder,.075)
    for j in range(5):
        a=j*2*PI/5
        petal(builder,(0,0,.075),.36,.24,(.045,0,a),.082,CRIMSON,(1,.81,.76),steps=20,ripples=.021,pointed=.43)
    # Fused staminal column with anthers and the five red stigma lobes.
    points=[(0,0,.08),(.011,0,.21),(.021,-.008,.34),(.028,-.015,.46)]
    tube(builder,points,.009,IVORY,(1,.58,.17),sides=9,end_radius=.007)
    for j in range(21):
        t=j/20; a=j*2.399; z=.19+.21*t
        p=(.015+math.cos(a)*.021,math.sin(a)*.022,z)
        tube(builder,[(.014,0,z-.003),p],.0016,IVORY,(1,.68,.11),sides=4)
        ellipsoid(builder,p,(.006,.004,.004),IVORY,(1,.71,.1),segments=7,rings=4)
    for j in range(5):
        a=j*2*PI/5
        p=(.028+math.cos(a)*.022,-.015+math.sin(a)*.022,.475)
        tube(builder,[points[-1],p],.003,CRIMSON,(.7,.4,.4),sides=5)
        ellipsoid(builder,p,(.008,.007,.007),CRIMSON,(.76,.3,.38),segments=8,rings=5)

def lotus(builder):
    flower_base(builder,-.04,False)
    for layer,count in enumerate([10,8,6]):
        for j in range(count):
            a=j*2*PI/count+layer*.35
            petal(builder,(0,0,-.025+layer*.025),.35-layer*.042,.1-layer*.008,
                  (.13+layer*.26,0,a),.087,IVORY,(1,.54+layer*.08,.70+layer*.08),steps=13,pointed=.78)
    pollen(builder,(0,0,.13),.059,.034,(1,.72,.16),24)

def cinnamon(builder):
    for quill in range(3):
        offset=len(builder.vertices); sections=14; coils=55
        origin=((quill-1)*.145,0,.01*quill)
        rot=(.11*quill,.12*(quill-1),.06*(quill-1))
        for j in range(sections+1):
            v=j/sections; z=(v-.5)*.57
            for k in range(coils+1):
                u=k/coils; a=2*PI*(.11+1.52*u)
                radius=.014+.064*u
                radius+=.0018*math.sin(j*2.4+k*.5)
                p=(radius*math.cos(a),radius*math.sin(a),z+.002*math.sin(k*.7))
                builder.vertex(transform(p,origin,rot),BARK,(u,v),(.86,.79,.72))
        for j in range(sections):
            for k in range(coils):
                a=offset+j*(coils+1)+k; b=a+coils+1
                builder.face((a,a+1,b+1,b))
        # Papery cut ends retain the recognizable spiral rather than a solid tube.
        for j in [0,sections]:
            pts=[]
            for k in range(0,coils+1,3):
                u=k/coils; a=2*PI*(.11+1.52*u); radius=.014+.064*u
                pts.append(transform((radius*math.cos(a),radius*math.sin(a),(j/sections-.5)*.57),origin,rot))
            tube(builder,pts,.0017,BARK,(.75,.60,.47),sides=4,end_radius=.0017)

def coconut(builder):
    # Open hemisphere with irregular fibrous rim, white endosperm and deep hollow.
    segments=64; rings=18
    def hemisphere(tile,radius,centerz,interior,color,material=0):
        offset=len(builder.vertices)
        for j in range(rings+1):
            v=j/rings; theta=v*1.56
            for k in range(segments+1):
                u=k/segments; a=2*PI*u
                fuzz=1+(.006 if interior else .016)*math.sin(a*11+v*8)+.005*math.sin(a*29)
                r=radius*math.sin(theta)*fuzz
                z=centerz-radius*.79*math.cos(theta)
                if not interior: z+=.002*math.sin(a*23+v*13)
                p=(r*math.cos(a),r*math.sin(a),z)
                builder.vertex(p,tile,(u,v),color)
        for j in range(rings):
            for k in range(segments):
                a=offset+j*(segments+1)+k; b=a+segments+1
                builder.face((a,b,b+1,a+1) if interior else (a,a+1,b+1,b),material)
        return [Vector(builder.vertices[offset+rings*(segments+1)+k]) for k in range(segments+1)]
    outer_lip=hemisphere(HUSK,.315,.022,False,(.92,.88,.8))
    inner_lip=hemisphere(IVORY,.266,.019,True,(1,1,.97),1)
    # One continuous annular cut joins the exact endpoint of the concave flesh
    # to the brown shell. No rolled white tube or intersecting surfaces remain.
    rim_start=len(builder.vertices)
    cut_outer=[]
    for fraction in [0,.35,.70,1]:
        for k in range(segments+1):
            u=k/segments;a=2*PI*u
            inner=inner_lip[k];outer=outer_lip[k].copy();outer.x*=.968;outer.y*=.968
            point=inner.lerp(outer,fraction)
            builder.vertex(point,IVORY,(u,fraction),(1,1,.98))
            if fraction==1:cut_outer.append(point)
    for j in range(3):
        for k in range(segments):
            a=rim_start+j*(segments+1)+k;b=a+segments+1
            builder.face((a,b,b+1,a+1),1)
    testa_start=len(builder.vertices)
    for lip,v in [(cut_outer,0),(outer_lip,1)]:
        for k,point in enumerate(lip):builder.vertex(point,HUSK,(k/segments,v),(.82,.78,.69))
    for k in range(segments):
        a=testa_start+k;b=a+segments+1
        builder.face((a,b,b+1,a+1))
    # Silhouette fibers are small, tapered real strands rather than a flat bump.
    for j in range(76):
        a=j*2.399; t=.34+(j%9)/10; theta=.13+t*1.4
        r=.318*math.sin(theta); z=.022-.315*.79*math.cos(theta)
        length=.011+(j%5)*.003
        p=(r*math.cos(a),r*math.sin(a),z)
        q=((r+length)*math.cos(a+.027),(r+length)*math.sin(a+.027),z+.007)
        tube(builder,[p,q],.00105,HUSK,(.8,.77,.61),sides=3,end_radius=.0001)

def aloe(builder):
    for j in range(5):
        a=j*2*PI/5
        rotation=(PI/2-.22-.11*(j%2),.15*math.sin(a),a)
        leaf(builder,(0,0,-.27),.59,.052,rotation,'aloe',.11,.073,LEAF,(.65,.84,.56),steps=17,ribs=False)
        for k in range(1,10):
            t=k/12
            span=.052*math.sin(PI*t)**.6*(1-.65*t)
            for side in [-1,1]:
                p=(span*side,t*.59,.073*(math.sin(PI*t)*(-.17)+t*t))
                tip=(p[0]+side*.008,p[1]+.004,p[2]+.003)
                tube(builder,[transform(p,(0,0,-.27),rotation),transform(tip,(0,0,-.27),rotation)],
                     .002,IVORY,(.82,.83,.5),sides=3,end_radius=.0001)

def clove(builder):
    for j in range(5):
        a=j*2.399; x=math.cos(a)*.09; y=math.sin(a)*.07
        tube(builder,[(x,y,-.24),(x+.007,y,-.06),(x-.007,y,.1)],.018,DARK_SEED,(.8,.61,.39),sides=10,end_radius=.009)
        ellipsoid(builder,(x-.007,y,.12),(.044,.043,.047),DARK_SEED,(.8,.64,.5),segments=16,rings=9,wrinkle=.11)
        for k in range(4):
            petal(builder,(x-.007,y,.08),.065,.013,(.51,0,k*PI/2),.016,DARK_SEED,(.7,.57,.45),steps=6)

def chili(builder):
    tube(builder,[(0,0,-.30),(.021,.01,-.23),(.03,.013,-.09),(.02,0,.05),(0,0,.18)],
         .003,CRIMSON,(1,.55,.34),sides=24,end_radius=.055)
    ellipsoid(builder,(0,0,.155),(.054,.055,.06),CRIMSON,(1,.58,.42),segments=24,rings=10,wrinkle=.03)
    tube(builder,[(0,0,.18),(.017,0,.225),(.042,.007,.26)],.009,LEAF,(.65,.8,.4),sides=7)
    for j in range(5): leaf(builder,(0,0,.19),.056,.016,(.63,0,j*2*PI/5),'lance',0,.007,tint=(.66,.77,.4),steps=6,ribs=False)

def fruit(builder, kind):
    if kind=='amla':
        for j in range(2):
            ellipsoid(builder,((j-.5)*.23,0,0),(.145,.143,.14),OLIVE,(.90,1,.61),segments=30,rings=16,wrinkle=.015,lobes=6)
            tube(builder,[((j-.5)*.23,0,.12),((j-.5)*.23+.013,0,.165)],.006,BARK,(.69,.59,.37),sides=6)
    else:
        ellipsoid(builder,(0,0,0),(.24,.235,.24),IVORY,(1,.40,.04),segments=32,rings=20,wrinkle=.015)
        tube(builder,[(0,0,.22),(.007,.004,.275)],.008,BARK,(.62,.48,.30),sides=8)
        leaf(builder,(0,0,.256),.18,.045,(.55,0,-PI/3),'ovate',0,.035,tint=(.55,.81,.52))

def fernlike(builder, silvery=False):
    stem(builder,.6)
    for j in range(7):
        z=-.24+j*.068
        for side in [-1,1]:
            end=(side*(.11-.006*j),0,z+.06)
            tube(builder,[(0,0,z),end],.0028,BARK,(.65,.76,.46),sides=5)
            for k in range(3):
                base=(side*.028*(k+1),0,z+.016*(k+1))
                leaf(builder,base,.065,.01,(PI/2-.26,.95*side,.05),'needle',.08,.01,
                     OLIVE if silvery else LEAF,(.83,.9,.77) if silvery else (.65,.83,.5),steps=7,ribs=False)

def cassytha(builder):
    for j in range(4):
        points=[]
        for k in range(22):
            t=k/21; a=t*PI*3+j*1.35
            points.append((math.sin(a)*(.11+.022*j),math.cos(a)*.065,-.29+t*.58))
        tube(builder,points,.0048,IVORY,(.76,.6,.12),sides=6,end_radius=.0028)
    for j in range(5):
        z=-.19+j*.085
        ellipsoid(builder,(.13*math.sin(j*2),.05,z),(.015,.014,.018),IVORY,(.9,.85,.65),segments=10,rings=6)

ingredient_source=(ROOT/'lib'/'ingredients.ts').read_text(encoding='utf-8')
match=re.search(r'export\s+const\s+ingredientNames\s*=\s*\[(.*?)\]\s*as\s+const',ingredient_source,re.S)
assert match, 'ingredientNames array not found'
names=re.findall(r"'([^']+)'",match.group(1))
assert len(names)==52 and len(set(names))==52 and names.count('Hibiscus rosa-sinensis')==1
assert names[0]=='Sesamum indicum' and names[-1]=='Cocos nucifera'

specimens=[]; entries=[]
for index,name in enumerate(names,1):
    builder=Builder(); family='leaf sprig'; form='Curved veined foliage'
    if index==1:
        seeds(builder,IVORY,(1,.94,.8),count=11,scale=(.023,.012,.043),wrinkle=.03)
        family='seed'; form='Ivory oval sesame seeds, tapered tips and subtle testa texture'
    elif index==2:
        seeds(builder,DARK_SEED,(.12,.13,.12),count=9,scale=(.029,.020,.039),wrinkle=.14,angular=True)
        family='seed'; form='Small angular black cumin seeds with matte ridged coats'
    elif index==3:
        seeds(builder,PALE_SEED,(.77,.66,.49),count=4,scale=(.060,.040,.076),wrinkle=.04,seam=.05)
        family='seed'; form='Oval castor seeds with textured coats and raised caruncles'
        for j in range(4):
            a=j*2.399;r=.07+.065*j/3
            ellipsoid(builder,(math.cos(a)*r,math.sin(a)*r,.057),(.015,.017,.011),IVORY,(.83,.76,.60),segments=10,rings=6)
    elif index==4:
        # Tocopherol is a compound, so the representation intentionally is oil.
        for j in range(3):
            ellipsoid(builder,((j-1)*.12,0,.06*(j-1)),(.055,.055,.083),IVORY,(1,.64,.14),segments=24,rings=14)
        family='oil drop'; form='Amber oil droplets representing tocopherol'
    elif index in [5,20,35,38,40,41]:
        roots(builder, (.8,.35,.20) if index in [5,38] else (.95,.82,.66) if index==20 else (.89,.77,.57), fibrous=index in [35,41])
        family='root'; form='Irregular branched root fragments' if index not in [35,41] else 'Fine tangled fibrous root bundle'
    elif index==6:
        flower_base(builder,.07)
        for j in range(5): petal(builder,(0,0,.08),.26,.14,(.07,0,j*2*PI/5),.03,IVORY,(1,.74,.07),steps=14)
        for j in range(7):
            a=j*2.399; p=(math.cos(a)*.03,math.sin(a)*.03,.17+random.random()*.02)
            tube(builder,[(0,0,.08),p],.002,IVORY,(.77,.5,.13),sides=4)
            ellipsoid(builder,p,(.011,.005,.012),DARK_SEED,(.71,.51,.24),segments=8,rings=5)
        family='flower'; form='Five loose yellow petals with differentiated anthers'
    elif index in [7,17]:
        jasmine(builder,index==17); family='flower'; form='Ivory jasmine star' if index==7 else '24-point cream white Mimusops corolla'
    elif index==8:
        rose(builder);family='flower';form='35 cupped rose petals arranged in overlapping whorls'
    elif index==9: sprig(builder,6,serration=.13,width=.11,tint=(.66,.90,.60));form='Serrated opposite peppermint leaves'
    elif index==10:
        seeds(builder,PALE_SEED,(.86,.76,.55),count=6,scale=(.058,.053,.057),wrinkle=.025)
        # Raised longitudinal ribs make coriander recognizable at silhouette scale.
        for j in range(6):
            a=j*2.399;r=.07+.065*j/5;c=(math.cos(a)*r,math.sin(a)*r,.015*math.sin(j*2))
            for k in range(9):
                phi=k*2*PI/9
                points=[(c[0]+.059*math.sin(PI*t/10)*math.cos(phi),c[1]+.054*math.sin(PI*t/10)*math.sin(phi),c[2]+.057*math.cos(PI*t/10)) for t in range(1,10)]
                tube(builder,points,.0018,PALE_SEED,(.78,.69,.50),sides=4,end_radius=.0018)
        family='seed';form='Spherical coriander fruits with longitudinal ribs'
    elif index==11: sprig(builder,5,'lance',.01,.070,.32,(.69,.83,.62),'alternate');form='Smooth leathery lanceolate bay leaves'
    elif index==12: sprig(builder,4,'heart',.01,.17,.29,(.52,.78,.53),'alternate');form='Broad pointed heart-shaped betel leaves'
    elif index==13: sprig(builder,7,'ovate',0,.043,.21,(.65,.84,.52));form='Small paired entire henna leaves'
    elif index==14:
        daisy(builder,19,(1,1,.91),False);family='flower';form='Small white Eclipta ray florets around a pale disk'
    elif index==15:
        daisy(builder,12,(1,.78,.06),True,False);family='flower';form='Yellow creeping oxeye daisy with broad ray florets'
    elif index==16:
        fruit(builder,'amla');family='fruit';form='Two pale green amla fruits with six longitudinal lobes'
    elif index==18:
        cinnamon(builder);family='bark';form='Three rolled papery cinnamon quills with visible spirals'
    elif index==19:
        daisy(builder,22);family='flower';form='Chamomile: thin ivory rays and raised golden pollen cone'
    elif index==21:
        fernlike(builder,True);family='leaf sprig';form='Finely divided silvery davana foliage'
    elif index==22:
        lotus(builder);family='flower';form='Pointed blush lotus petals in three ascending whorls'
    elif index==23:
        rosemary(builder);form='Woody rosemary stem with narrow recurved needle leaves'
    elif index==24:
        aloe(builder);family='succulent';form='Curved fleshy aloe blades with small pale marginal teeth'
    elif index==25:
        sprig(builder,8,'lance',.015,.042,.20,(.58,.86,.48));form='Pinnate curry leaf stem with eight pointed leaflets'
    elif index==26:
        hibiscus(builder);family='flower';form='Five ruffled crimson hibiscus petals, pollen column and five stigma lobes'
    elif index==27: sprig(builder,6,'ovate',.16,.095,.245,(.56,.81,.42),'alternate');form='Serrate ovate Acalypha foliage'
    elif index==28: sprig(builder,6,'ovate',.11,.087,.23,(.59,.76,.46));form='Opposite scalloped holy basil leaves'
    elif index==29:
        seeds(builder,PALE_SEED,(.84,.49,.29),count=3,scale=(.092,.043,.15),wrinkle=.10,seam=.05);family='seed';form='Three elongated almonds with fine skin furrows and pointed tips'
    elif index==30:
        seeds(builder,OLIVE,(.59,.80,.45),count=6,scale=(.052,.010,.095),wrinkle=.025);family='seed';form='Flat green pumpkin kernels with fine peripheral contours'
    elif index==31: sprig(builder,5,'ovate',.02,.13,.28,(.72,.94,.65));form='Broad soft cupped sweet basil leaves'
    elif index==32:
        chili(builder);family='fruit';form='Tapering curved red chili with folded green calyx'
    elif index==33:
        seeds(builder,DARK_SEED,(.92,.65,.44),count=4,scale=(.095,.063,.127),wrinkle=.07,seam=.30);family='coffee bean';form='Roasted coffee beans with sculpted central sutures'
    elif index==34: sprig(builder,5,'lance',.09,.091,.30,(.58,.81,.49),'alternate');form='Serrate glossy tea leaves with alternating attachment'
    elif index==36:
        cassytha(builder);family='vine';form='Fine twining golden Cassytha filaments and small cream buds'
    elif index==37:
        seeds(builder,DARK_SEED,(.53,.44,.32),count=7,scale=(.036,.024,.053),wrinkle=.16);family='seed';form='Dark rugose Psoralea seeds'
    elif index==39: sprig(builder,8,'lance',.11,.039,.24,(.59,.80,.43));form='Pinnate neem leaflets with serrated pointed margins'
    elif index==42:
        ellipsoid(builder,(0,0,-.1),(.19,.18,.20),CRIMSON,(.40,.12,.23),segments=26,rings=16,wrinkle=.025)
        tube(builder,[(0,0,-.24),(.02,0,-.35),(.034,.02,-.41)],.035,CRIMSON,(.40,.13,.22),sides=10,end_radius=.001)
        for j in range(3):
            tube(builder,[(0,0,.06),(.022*math.sin(j),0,.15)],.009,CRIMSON,(.48,.17,.26),sides=6)
            leaf(builder,(0,0,.15),.23,.07,(PI/2,.4*(j-1),j*2.399),'ovate',.04,.03,tint=(.60,.81,.46))
        family='root vegetable';form='Beetroot with irregular taproot and three leaf stalks'
    elif index==43:
        tube(builder,[(0,0,.16),(.018,0,-.04),(.026,0,-.26),(.06,.01,-.37)],.10,IVORY,(1,.37,.05),sides=24,end_radius=.001)
        for j in range(4):
            branch=Builder()
            a=j*2.399
            for k in range(4):
                leaf(builder,(math.cos(a)*.02,math.sin(a)*.02,.18+k*.025),.13,.016,
                     (PI/2,.6*math.sin(a),a+k*.17),'lobed',.09,.017,tint=(.59,.81,.40),steps=8,ribs=False)
        family='root vegetable';form='Orange carrot root with delicate divided green top'
    elif index==44:
        daisy(builder,21,(1,.64,.025),True,False)
        # A wider brown disk and actual dark florets distinguish sunflower.
        ellipsoid(builder,(0,0,.17),(.113,.113,.056),DARK_SEED,(.66,.49,.24),segments=24,rings=12,wrinkle=.07)
        for j in range(72):
            a=j*2.399;r=.106*math.sqrt(j/72);z=.17+.057*math.sqrt(max(0,1-(r/.113)**2))
            ellipsoid(builder,(math.cos(a)*r,math.sin(a)*r,z),(.005,.005,.007),DARK_SEED,(.58,.49,.25),segments=5,rings=3)
        family='flower';form='Sunflower yellow ray petals and textured dark seed disk'
    elif index==45:
        flower_base(builder,.03)
        petal(builder,(0,0,.04),.32,.235,(.19,0,0),.16,IVORY,(.23,.22,.85),steps=19,pointed=.42)
        for j in range(2): petal(builder,(0,0,.07),.14,.085,(.45,0,PI*.78+j*.44),.03,IVORY,(.24,.23,.84),steps=10)
        petal(builder,(0,0,.08),.08,.045,(.4,0,0),.035,IVORY,(1,.93,.75),steps=8)
        family='flower';form='Butterfly pea broad indigo standard petal and pale throat'
    elif index==46:
        seeds(builder,DARK_SEED,(.25,.25,.23),count=8,scale=(.045,.042,.044),wrinkle=.18);family='seed';form='Round wrinkled dark peppercorns'
    elif index==47:
        seeds(builder,DARK_SEED,(1,.76,.49),count=9,scale=(.030,.012,.054),wrinkle=.025);family='seed';form='Smooth flattened flax seeds with pointed ends'
    elif index==48:
        clove(builder);family='spice bud';form='Five cloves: tapered dark stalks, four sepals and rounded buds'
    elif index==49:
        seeds(builder,DARK_SEED,(.94,.78,.50),count=6,scale=(.051,.033,.063),wrinkle=.06,seam=.06);family='seed';form='Brown oblong horse gram seeds with hilum sutures'
    elif index==50: sprig(builder,5,'ovate',.01,.10,.29,(.53,.78,.53),'alternate');form='Smooth pointed leathery camphor leaves'
    elif index==51:
        fruit(builder,'orange');family='fruit';form='Orange citrus fruit with gently dimpled rind and leaf'
    elif index==52:
        coconut(builder);family='coconut';form='Hollow coconut half: fibrous husk, testa and thick white endosperm'
    material=petal_organic if family=='flower' else leaf_organic if family in ['leaf sprig','succulent','vine'] else dry_organic
    materials=[dry_organic,flesh_organic] if index==52 else [oil_material] if index==4 else [material]
    obj=builder.build('Ingredient_%02d'%index,materials)
    obj['ingredient_id']=index;obj['ingredient_name']=name;obj['family']=family
    obj['representation']=form
    specimens.append(obj)
    entries.append({'id':index,'name':name,'node':obj.name,'family':family,'representation':form})

def lathe(builder, profile, segments=96, material=0):
    offset=len(builder.vertices)
    for j,(radius,z) in enumerate(profile):
        for k in range(segments+1):
            a=2*PI*k/segments
            builder.vertex((radius*math.cos(a),radius*math.sin(a),z),BARK,(k/segments,j/(len(profile)-1)),(1,1,1))
    for j in range(len(profile)-1):
        for k in range(segments):
            a=offset+j*(segments+1)+k;b=a+segments+1
            builder.face((a,a+1,b+1,b),material)

bowl=Builder()
profile=[(.001,-.265),(.39,-.265),(.51,-.245),(.74,-.202),(.93,-.123),(1.10,-.025),(1.26,.089),
         (1.40,.225),(1.468,.296),(1.48,.31),(1.483,.326),(1.478,.338),(1.465,.346),(1.448,.342),
         (1.431,.326),(1.425,.304),(1.34,.232),(1.18,.104),(.99,-.02),(.78,-.125),(.53,-.193),(.37,-.208),(.001,-.208)]
lathe(bowl,profile,128)
for r,z in [(1.472,.315),(1.473,.333),(.98,-.094),(1.245,.092),(1.410,.255)]:
    points=[(r*math.cos(2*PI*k/128),r*math.sin(2*PI*k/128),z) for k in range(129)]
    offset=len(bowl.slots)
    tube(bowl,points,.0024,BARK,(1,1,1),sides=4,end_radius=.0024)
    bowl.slots[offset:]=[1]*(len(bowl.slots)-offset)
vessel=bowl.build('Vessel',[brass,brass_detail],False)

liquid=Builder()
lathe(liquid,[(.001,0),(1.27,0),(1.32,.009),(1.333,.024),(1.326,.032),(1.27,.036),(.001,.036)],96)
oil=liquid.build('Oil',[oil_material],False)

bpy.ops.object.select_all(action='DESELECT')
for obj in specimens+[vessel,oil]:obj.select_set(True)
export_options=dict(export_format='GLB',use_selection=True,export_extras=True,export_yup=True,
                    export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',
                    export_vertex_color='NAME',export_vertex_color_name='Color',export_image_format='JPEG',
                    export_jpeg_quality=94,export_cameras=False,export_lights=False)
if os.environ.get('AMSA_PREVIEW_ONLY')!='1':
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/'botanicals-realistic-uncompressed.glb'),**export_options)

# Blender 5.2 normally filters positions and normals to 12 bits for Meshopt.
# Use its bundled encoder bridge without that lossy filter: all vertex floats,
# colors and UVs retain their full precision. No Blender installation is edited.
from io_scene_gltf2.io.exp.meshopt import MeshoptEncoder
def lossless_attribute(attribute_name,data,byte_stride,export_settings):
    MeshoptEncoder.load_library(export_settings)
    library=export_settings['meshopt_encoder']
    array=np.ascontiguousarray(data)
    count=len(array);stride=array.strides[0]
    bound=library.encodeVertexBufferBound(count,stride)
    result=(ctypes.c_ubyte*bound)()
    written=library.encodeVertexBuffer(result,bound,array.ctypes.data_as(ctypes.c_void_p),count,stride)
    return bytes(result[:written]),None
MeshoptEncoder.encode_attribute=staticmethod(lossless_attribute)
if os.environ.get('AMSA_PREVIEW_ONLY')!='1':
    bpy.ops.export_scene.gltf(filepath=str(OUT/'botanicals.glb'),export_meshopt_compression_enable=True,
                              export_meshopt_extension='EXT_meshopt_compression',**export_options)

manifest={'version':2,'assets':{'product':'/models/keshya.glb','botanicals':'/models/botanicals.glb'},
          'note':'Art-directed botanical specimen representations for an illustrative ingredient-to-oil journey; plant part/extraction is not specified by this illustration.',
          'texture':{'kind':'shared photographic 3x3 color atlas and tangent surface normal map','size':list(atlas_image.size) if atlas_image else [0,0]},
          'compression':{'extension':'EXT_meshopt_compression','attributes':'lossless; no position, normal or UV quantization','simplification':False},
          'entries':entries}
if os.environ.get('AMSA_PREVIEW_ONLY')!='1':
    (OUT/'ingredients-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')

# Source contains all normalized assets and a Cycles studio preview. It is not
# shipped to browsers: only the compact binary glTF is served by the website.
floor_material=plain_material('Warm sand studio cyclorama',(.56,.47,.34),.86)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.43))
floor=bpy.context.object;floor.name='Studio ground';floor.data.materials.append(floor_material)

def area(name,location,power,size,color=(1,.94,.84),target=(0,0,0)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large soft key',(-3,-4,6),720,5)
area('Leaf rim',(3,3,4),560,4,(.92,1,.92))
area('Low studio reflector',(1,-4,2),170,3)
camera_data=bpy.data.cameras.new('Botanical studio camera');camera=bpy.data.objects.new('Botanical studio camera',camera_data)
bpy.context.collection.objects.link(camera)
camera_data.type='ORTHO'
scene=bpy.context.scene;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=int(os.environ.get('AMSA_RENDER_SAMPLES','64'));scene.cycles.use_denoising=True
try:
    preferences=bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type='CUDA';preferences.get_devices()
    gpu_found=False
    for device in preferences.devices:
        device.use=device.type=='CUDA';gpu_found=gpu_found or device.use
    if gpu_found and os.environ.get('AMSA_USE_CUDA')=='1':scene.cycles.device='GPU'
    print('BOTANICAL_RENDER_DEVICE',scene.cycles.device,[(device.name,device.type,device.use) for device in preferences.devices])
except Exception as error:
    print('Cycles GPU unavailable; rendering on CPU:',str(error))
scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.14,.16,.14,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.35
vessel.hide_render=True;oil.hide_render=True
for j,obj in enumerate(specimens):
    col=j%13;row=j//13
    obj.location=(col*.82-4.92,row*1.00-1.50,-.02)
    family=entries[j]['family']
    obj.rotation_euler=(PI/2-.46 if family in ['flower','coconut'] else .05,0,random.uniform(-.13,.13))
camera.location=(0,-10,11)
camera.rotation_euler=(Vector((0,.0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=11.1
scene.render.resolution_x=2200;scene.render.resolution_y=1300
scene.render.filepath=str(SOURCE/'botanicals-realistic-collection.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'botanicals-realistic.blend'))
if os.environ.get('AMSA_SKIP_RENDER')!='1' and os.environ.get('AMSA_SKIP_COLLECTION')!='1':
    scene.cycles.samples=int(os.environ.get('AMSA_COLLECTION_SAMPLES',str(scene.cycles.samples)))
    bpy.ops.render.render(write_still=True)

for obj in specimens:obj.hide_render=True
featured=[52,26,23,1,18]
positions=[(-1.36,.0,0),(-.10,.05,.07),(.99,.12,.04),(-.64,-.59,-.12),(1.38,-.53,.04)]
scales=[2.55,2.1,1.7,1.3,1.6]
for number,position,scale in zip(featured,positions,scales):
    obj=specimens[number-1];obj.hide_render=False;obj.location=position;obj.scale=(scale,)*3
    if number==52:obj.rotation_euler=(.13,-.20,.18)
    elif number in [26,8]:obj.rotation_euler=(.2,-.10,.4)
    elif number==23:obj.rotation_euler=(.08,.16,-.15)
    else:obj.rotation_euler=(.08,.20,.4)
camera.location=(2,-5.8,5.4)
camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=4.8
scene.render.resolution_x=2000;scene.render.resolution_y=1400
scene.render.filepath=str(SOURCE/'botanicals-realistic-detail.png')
scene.cycles.samples=int(os.environ.get('AMSA_RENDER_SAMPLES','64'))
if os.environ.get('AMSA_SKIP_RENDER')!='1' and os.environ.get('AMSA_SKIP_DETAIL')!='1':bpy.ops.render.render(write_still=True)

print('BOTANICAL_REPORT',json.dumps({'bytes':(OUT/'botanicals.glb').stat().st_size,'ingredients':len(specimens),
      'triangles':sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in specimens+[vessel,oil]),
      'atlas_size':list(atlas_image.size) if atlas_image else None,'preview':str(SOURCE/'botanicals-realistic-detail.png')}))
