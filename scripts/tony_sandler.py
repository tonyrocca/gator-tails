from PIL import Image, ImageDraw, ImageFilter, ImageStat, ImageChops
import numpy as np, sys
K=3
sand=Image.open(sys.argv[2]).convert('RGB'); sand=sand.resize((sand.width*K,sand.height*K),Image.LANCZOS)
tony=Image.open(sys.argv[1]).convert('RGB')
# landmarks
t_eyes=np.array([(338,352),(466,350)],float); s_eyes=np.array([(210,72.5),(233.8,71)],float)*K
t_mid=t_eyes.mean(0); s_mid=s_eyes.mean(0)
sc=np.linalg.norm(s_eyes[1]-s_eyes[0])/np.linalg.norm(t_eyes[1]-t_eyes[0])
tw,th=int(tony.width*sc),int(tony.height*sc)
ts=tony.resize((tw,th),Image.LANCZOS)
off=(int(round(s_mid[0]-t_mid[0]*sc)),int(round(s_mid[1]-t_mid[1]*sc)))
layer=Image.new('RGB',sand.size); layer.paste(ts,off)
# face mask (tony coords -> sand coords): brows to chin, inside cheeks
m=Image.new('L',sand.size,0); md=ImageDraw.Draw(m)
def T(x,y): return (off[0]+x*sc, off[1]+y*sc)
x0,y0=T(282,298); x1,y1=T(522,552); md.ellipse([x0,y0,x1,y1],fill=255)
m=m.filter(ImageFilter.GaussianBlur(5*K))
# color match tony face to sandler skin
a=np.asarray(layer).astype(float); b=np.asarray(sand).astype(float); mm=np.asarray(m)>200
for c in range(3):
    ta,sb=a[...,c][mm],b[...,c][mm]
    a[...,c]=(a[...,c]-ta.mean())/(ta.std()+1e-6)*sb.std()*0.85+sb.mean()
layer=Image.fromarray(np.clip(a,0,255).astype('uint8'))
out=Image.composite(layer,sand,m)
# bring back sandler's beard/mustache where his pixels are dark in the lower face
bm=np.zeros((sand.height,sand.width),float)
lum=b.mean(2)
ys,xs=np.mgrid[0:sand.height,0:sand.width]
cx,cy=223.5*K,103*K
region=(((xs-cx)/(27*K))**2+((ys-cy)/(17*K))**2)<=1
mouth=(((xs-224*K)/(11*K))**2+((ys-96*K)/(4.2*K))**2)<=1
dark=lum<95
bm[region & dark & ~mouth]=0.9
beard=Image.fromarray((bm*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2*K))
out=Image.composite(sand,out,beard)
# rimless glasses
d=ImageDraw.Draw(out,'RGBA'); g=(205,195,165,150)
for (ex,ey) in s_eyes:
    d.rounded_rectangle([ex-9.5*K,ey-6*K,ex+9.5*K,ey+6.5*K],radius=4*K,outline=g,width=max(1,int(0.6*K)),fill=(220,235,255,18))
d.line([(s_eyes[0][0]+9.5*K,s_eyes[0][1]-1*K),(s_eyes[1][0]-9.5*K,s_eyes[1][1]-1*K)],fill=g,width=max(1,int(0.6*K)))
out=out.resize((sand.width*2//K,sand.height*2//K),Image.LANCZOS)
out.save(sys.argv[3],'JPEG',quality=88)
print('ok',out.size)
