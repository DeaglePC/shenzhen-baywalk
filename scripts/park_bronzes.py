"""Build the two photographed bronze groups from their visible cross sections.
Pass the folder of the user's numbered photographs. Images are sampled only
inside the traced figure profiles; the distributable GLBs contain bronze surfaces.
"""
import io,json,math,struct,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

OUT=Path(__file__).resolve().parents[1]/'public/city'
SOURCE=Path(sys.argv[1])
photos={i:np.asarray(Image.open(next(SOURCE.glob(str(i)+'-*.jpg'))).convert('RGB').resize((450,800) if i!=7 else (640,480)),float)/255
        for i in (1,2,3,7)}
N=40
class Bronze:
    def __init__(self):
        self.parts=[]
    def figure(self,img,x,ground,scale,offset,back=None):
        self.img,self.x,self.ground,self.scale,self.offset,self.back=img,x,ground,scale,offset,back
    def form(self,profile,depth=.9,z=0,face=False,swatch=False,back=None):
        # Rows give the top-to-bottom visible contour, with separate depth for
        # coats, trousers, hands and the elevated arm. Front and rear share a mesh.
        profile=np.asarray(profile,float)
        v=np.linspace(profile[0,0],profile[-1,0],max(10,round((profile[-1,0]-profile[0,0])/4)))
        ang=np.linspace(-np.pi,np.pi,N+1)
        rows,theta=np.meshgrid(v,ang,indexing='ij')
        def interp(j):return np.interp(rows,profile[:,0],profile[:,j])
        L,R=interp(1),interp(2);w=(R-L)*.5;u=(R+L)*.5+w*np.sin(theta)
        h=(rows-v[0])/(v[-1]-v[0]);d=depth*w
        Z=np.cos(theta)*d+z+(interp(3) if profile.shape[1]>3 else 0)
        if face:
            nose=np.exp(-((u-(L+R)*.5)/(.18*w+1))**2-((h-.56)/.14)**2)
            chin=np.exp(-((h-.8)/.14)**2)
            Z+=(nose*.49+chin*.07)*w*np.maximum(0,np.cos(theta))**3
        img=photos[self.img]
        def colors(im,y,x):
            return np.stack([map_coordinates(im[:,:,k],[y,x],order=1,mode='nearest') for k in range(3)],axis=-1)
        front=colors(img,rows,np.clip(u,L+1,R-1))
        if swatch:
            front=colors(photos[3],235+22*np.sin(rows*.06+theta),209+19*np.sin(rows*.027+theta*2))
        ref=back or self.back
        if ref:
            left,right,top,bottom,source_top,source_bottom=ref
            rear=colors(photos[1],top+np.clip((rows-source_top)/(source_bottom-source_top),0,1)*(bottom-top),
                        left+(right-left)*(.5-.43*np.sin(theta)))
        else:
            rear=colors(photos[1],225+24*np.sin(rows*.024+theta)+h*80,216+20*np.sin(theta*2+rows*.045))
        blend=np.clip((np.cos(theta)+.30)/.65,0,1)[...,None]
        rgb=front*blend+rear*(1-blend)
        # Clay-tool marks and the patina are sampled from the bronze itself.
        gray=rgb@np.array([.3,.54,.16]);gray=np.clip(gray,.085,.74)
        rgb=(gray[...,None]*np.array([1.10,1.00,.91]))*.83+rgb*.17
        zdetail=(gray-.34)*np.minimum(w*.13,1.3)
        p=np.stack(((u-self.x)*self.scale+self.offset[0],(self.ground-rows)*self.scale,
                    (Z+zdetail)*self.scale+self.offset[1]),axis=-1)
        # One dense UV strip per closed volume. Sample texture at camera
        # resolution independent of the geometry tessellation.
        S=128;H=max(24,min(480,int(v[-1]-v[0])))
        ty,tx=np.meshgrid(np.linspace(0,1,H),np.linspace(-np.pi,np.pi,S),indexing='ij')
        Y=v[0]+ty*(v[-1]-v[0]);l=np.interp(Y,profile[:,0],profile[:,1]);r=np.interp(Y,profile[:,0],profile[:,2])
        X=(l+r)*.5+(r-l)*.485*np.sin(tx)
        col=colors(img,Y,X) if not swatch else colors(photos[3],235+22*np.sin(Y*.06+tx),209+19*np.sin(Y*.027+tx*2))
        if ref:
            rear=colors(photos[1],top+np.clip((Y-source_top)/(source_bottom-source_top),0,1)*(bottom-top),left+(right-left)*(.5-.43*np.sin(tx)))
        else:rear=colors(photos[1],225+24*np.sin(Y*.024+tx)+ty*80,216+20*np.sin(tx*2+Y*.045))
        blend=np.clip((np.cos(tx)+.3)/.65,0,1)[...,None];rgb=col*blend+rear*(1-blend)
        lum=np.clip(rgb@[.30,.54,.16],.09,.74)
        rgb=(lum[...,None]*[1.10,1.,.92])*.91+rgb*.09
        tile=Image.fromarray(np.uint8(np.clip(rgb,0,1)*255))
        ids=np.arange(p.shape[0]*(N+1)).reshape((-1,N+1));a=ids[:-1,:-1];b=ids[:-1,1:];c=ids[1:,:-1];e=ids[1:,1:]
        idx=np.stack((a,c,b,b,c,e),axis=-1).flatten().tolist()
        for j in range(1,N-1):idx.extend([0,j,j+1,ids[-1,0],ids[-1,j+1],ids[-1,j]])
        self.parts.append((p.reshape(-1,3),np.array(idx),tile))
    def save(self,name):
        width=1040;atlas=Image.new('RGB',(width,4096),(87,77,69));x=y=row_h=0
        verts=[];uv=[];faces=[];n=0
        for p,idx,tile in self.parts:
            w,h=tile.size
            if x+w+2>width:x=0;y+=row_h+4;row_h=0
            atlas.paste(tile,(x+1,y+1));k=len(p)//(N+1)
            us,vs=np.meshgrid(np.linspace(x+1.5,x+w+.5,N+1),np.linspace(y+1.5,y+h+.5,k))
            uv.extend(np.stack([us,vs],axis=-1).reshape(-1,2));verts.extend(p);faces.extend(idx+n);n+=len(p)
            x+=w+3;row_h=max(row_h,h)
        height=y+row_h+3;atlas=atlas.crop((0,0,width,height));buf=io.BytesIO();atlas.save(buf,format='JPEG',quality=91)
        verts=np.asarray(verts,'<f4');uv=np.asarray(uv,'<f4')/[width,height];faces=np.asarray(faces,'<u2' if n<65536 else '<u4')
        normal=np.zeros_like(verts);tri=faces.reshape(-1,3);area=np.cross(verts[tri[:,1]]-verts[tri[:,0]],verts[tri[:,2]]-verts[tri[:,0]])
        for i in range(3):np.add.at(normal,tri[:,i],area)
        normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-15)
        chunks=[verts.tobytes(),np.asarray(uv,'<f4').tobytes(),normal.tobytes(),faces.tobytes(),buf.getvalue()]
        binary=bytearray();views=[]
        for ch in chunks:
            views.append(dict(buffer=0,byteOffset=len(binary),byteLength=len(ch)));binary.extend(ch);binary.extend(b'\0'*(-len(binary)%4))
        def acc(view,count,kind,ct):return dict(bufferView=view,count=count,type=kind,componentType=ct)
        attrs=[acc(0,n,'VEC3',5126),acc(1,n,'VEC2',5126),acc(2,n,'VEC3',5126),acc(3,len(faces),'SCALAR',5123 if n<65536 else 5125)]
        attrs[0].update(min=verts.min(axis=0).tolist(),max=verts.max(axis=0).tolist())
        doc=dict(asset={'version':'2.0'},scene=0,scenes=[{'nodes':[0]}],nodes=[{'mesh':0}],meshes=[{'primitives':[{
            'attributes':{'POSITION':0,'TEXCOORD_0':1,'NORMAL':2},'indices':3,'material':0}]}],
            materials=[dict(doubleSided=True,pbrMetallicRoughness=dict(baseColorTexture={'index':0},metallicFactor=.36,roughnessFactor=.67))],
            textures=[{'source':0}],images=[{'bufferView':4,'mimeType':'image/jpeg'}],accessors=attrs,bufferViews=views,buffers=[{'byteLength':len(binary)}])
        raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*(-len(raw)%4)
        (OUT/(name+'.glb')).write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(raw)+len(binary),len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary)

b=Bronze()
# The bespectacled figure and his folded coat are unobstructed in the oblique view.
b.figure(2,196,626,.00455,(-.70,-.21),(294,384,192,385,161,356))
b.form([(159,190,207),(172,158,214),(192,145,224),(245,149,238),(288,151,237),(355,155,237)],.53)
b.form([(86,193,207),(92,186,216),(108,180,223),(122,182,225),(143,190,217),(155,191,209),(173,188,208)],.77,7,True,back=(323,355,114,189,87,169))
b.form([(304,148,199),(376,143,183),(475,131,173),(578,127,154),(625,130,152)],.76)
b.form([(307,193,232),(396,187,228),(493,194,224),(599,196,228),(621,195,240)],.73,-7)
b.form([(167,146,162),(183,132,164),(234,122,149),(254,121,164),(272,126,160)],.86,4)
b.form([(243,130,168),(258,134,237),(268,145,240),(277,147,197)],.50,25)
b.form([(247,126,166),(270,123,172),(338,118,166),(404,100,173),(415,109,157)],.53,21)
b.form([(186,210,220),(205,218,241),(237,232,258),(265,235,260),(294,229,251)],.73)
b.form([(210,216,225),(218,212,240),(242,224,251),(277,231,255),(289,233,246)],.74,23)
b.form([(609,130,149,0),(620,128,153,6),(626,127,157,12)],1.35)
b.form([(601,198,223,-6),(614,196,234,1),(626,196,239,8)],.88)
# Central figure in the long open coat, raised forearm in front of the forehead.
b.figure(3,218,608,.00445,(0,.12),(182,266,194,456,133,447))
b.form([(129,205,241),(150,177,265),(163,166,274),(206,164,258),(259,159,254),(295,156,255),(315,156,253)],.62)
b.form([(51,217,233),(57,210,246),(72,208,249),(88,208,249),(104,211,247),(120,219,240),(144,214,240)],.89,6,True,back=(214,243,139,195,50,141))
b.form([(278,158,209),(347,158,200),(429,158,196),(486,159,193),(552,156,184),(577,139,181),(584,125,172)],.78,2)
b.form([(280,205,251),(348,209,253),(428,217,258),(499,228,260),(558,232,260),(595,236,258),(611,240,262)],.77,-3)
b.form([(150,167,185),(195,159,178),(287,145,172),(374,133,164),(438,109,153),(453,116,142)],.63,-12)
b.form([(155,240,253),(226,241,256),(318,247,263),(399,251,280),(440,247,265)],.70,-20)
b.form([(154,254,271),(169,254,288),(203,257,288),(243,256,283),(295,256,276),(331,251,271),(349,251,265)],.73)
b.form([(76,133,148,38),(89,116,154,30),(106,107,153,22),(127,127,168,13),(155,149,186,3),(171,161,180,0)],.74)
b.form([(26,176,192,50),(32,165,198,48),(58,142,178,44),(83,119,154,37),(98,110,143,30),(109,118,133,24)],.70)
b.form([(13,190,202),(19,181,203),(27,173,196),(37,169,193)],.55,55)
for j in range(4):
    tip=199+j*3
    b.form([(7+j,tip+2,tip+5),(11+j,tip-1,tip+6),(17+j,188+j*3,195+j*3),(22+j,183+j*3,191+j*3)],.80,56-j*3,swatch=True)
b.form([(554,159,184,-1),(574,151,179,6),(591,135,174,15),(607,123,165,18)],1.06,swatch=True)
b.form([(590,236,256,0),(600,235,262,7),(609,234,264,14)],1.13)
# Woman in a tailored jacket and knee-length skirt.
b.figure(3,349,624,.00438,(.69,-.10),(69,151,204,455,175,457))
b.form([(166,333,358),(182,309,378),(197,302,388),(232,308,383),(278,312,378),(318,300,390),(326,310,384)],.71)
b.form([(96,344,357),(103,338,367),(118,333,373),(133,334,370),(148,340,363),(157,345,359),(179,340,363)],.91,4,True,back=(105,135,136,195,96,175))
b.form([(302,306,387),(329,300,392),(378,302,394),(422,291,393),(455,291,395),(463,301,381)],.65)
b.form([(451,306,329),(489,307,327),(524,307,322),(564,307,320),(582,295,317)],.91,-6)
b.form([(453,339,367),(496,339,366),(543,338,360),(590,337,354),(624,335,354)],.88,3)
b.form([(189,300,312),(205,291,311),(258,287,303),(308,285,297),(345,282,297),(366,286,299)],.86,3)
b.form([(190,381,391),(202,385,402),(238,385,405),(296,387,404),(341,388,403),(375,384,397)],.83)
b.form([(571,304,320,-6),(588,300,318,1),(609,294,314,8),(624,290,313,14)],1.13,swatch=True)
b.form([(608,336,352,0),(618,334,355,9),(624,333,356,14)],1.30)
b.save('talent-navigators')
# Second group. The railing conceals their lower bodies in photograph 7.
# Sample clean coat patina for the occluded cloth; no visitor pixels enter the mesh.
b=Bronze()
for j,(cx,hy,offset) in enumerate([(202,113,-.65),(288,89,0),(397,118,.67)]):
 b.figure(7,cx,hy+267,.009,(offset,.12 if j==1 else -.15))
 def part(rows,d=.74,z=0,blank=False,head=False):
    b.form([(hy+y,cx+l,cx+r) for y,l,r in rows],d,z,head,blank)
 part([(0,-3,5),(4,-10,9),(12,-12,13),(23,-11,12),(33,-7,8),(44,-7,8)],.87,4,head=True)
 part([(39,-6,9),(46,-17,20),(55,-26,25),(79,-23,22),(121,-22,22),(147,-24,24)],.66,blank=True)
 # Retain the actual collars, jacket fronts and lapels above the glass handrail.
 last=min(182-hy,91)
 part([(40,-6,9),(48,-17,19),(57,-25,24),(last,-21,21)],.66,1)
 for sign in (-1,1):
    xx=sign*12
    part([(136,xx-11,xx+10),(163,xx-10,xx+10),(202,xx-8,xx+8),(247,xx-7,xx+7),(263,xx-8,xx+8)],.88,blank=True)
    part([(255,xx-6,xx+6),(263,xx-8,xx+8),(267,xx-8,xx+9)],1.21,5,blank=True)
 part([(48,14,23),(58,21,32),(100,22,32),(143,23,31),(152,25,30)],.86,blank=True)
 if j==1:
    b.form([(hy+7,cx-15,cx-11,38),(hy+15,cx-22,cx-9,35),(hy+30,cx-30,cx-13,27),(hy+49,cx-36,cx-17,14),(hy+64,cx-33,cx-16,0)],.86)
 else:
    part([(49,-23,-16),(61,-32,-20),(103,-31,-21),(149,-31,-23)],.85,blank=True)
 if j==0:
    part([(2,-5,6),(5,-11,10),(12,-16,15),(14,-16,10)],.96,2)
    part([(61,-23,-14),(106,-25,-15),(147,-46,-16),(171,-53,-20)],.64,-10,blank=True)
 if j==2:part([(151,19,25),(157,15,33),(198,15,33)],.64,blank=True)
b.save('talent-enterprise')
