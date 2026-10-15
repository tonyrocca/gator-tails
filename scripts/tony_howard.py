from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math, sys
src=Image.open(sys.argv[1]).convert('RGB'); W,H=src.size; px=src.load()
mask=Image.new('L',(W,H),0); mp=mask.load()
for y in range(H):
    for x in range(W):
        r,g,b=px[x,y]
        if y>520:
            if r+g+b>150 or (r>55 and r>b+8): mp[x,y]=255
        elif 215<x<590 and ((x-400)/178)**2+((y-344)/256)**2<=1:
            if not (b>r+4 or r+g+b<40): mp[x,y]=255
mask=mask.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.6)); mp=mask.load()
bg=Image.new('RGB',(W,H)); bd=ImageDraw.Draw(bg)
for y in range(H):
    t=y/H; bd.line([(0,y),(W,y)],fill=(int(70-30*t),int(42-20*t),int(28-14*t)))
for x in range(0,W,58): bd.line([(x,0),(x,H)],fill=(48,28,18),width=3)
for x in range(40,W,130): bd.ellipse([x-14,6,x+14,22],fill=(255,240,200))
gl=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(gl)
for x in range(40,W,130): gd.polygon([(x-10,16),(x+10,16),(x+90,H*0.55),(x-90,H*0.55)],fill=(255,230,170,28))
bg=Image.alpha_composite(bg.convert('RGBA'),gl.filter(ImageFilter.GaussianBlur(8))).convert('RGB'); bd=ImageDraw.Draw(bg)
bd.rounded_rectangle([W*0.06,30,W*0.40,96],radius=10,fill=(18,12,10),outline=(222,180,70),width=4)
bd.text((W*0.09,44),"KMH",fill=(240,205,110),font_size=46)
x0=20; bd.rectangle([x0,150,x0+150,420],fill=(30,20,16),outline=(200,170,90),width=3)
for k in range(5):
    yy=175+k*48; bd.line([(x0+10,yy+30),(x0+140,yy+30)],fill=(120,100,70),width=2)
    for j in range(4):
        cx=x0+25+j*33; c=[(250,215,90),(160,230,255),(255,120,190),(230,230,240)][(j+k)%4]; bd.ellipse([cx-7,yy+12,cx+7,yy+26],fill=c)
fx,fy=600,120
bd.rectangle([fx,fy,fx+150,fy+200],fill=(15,10,8),outline=(222,180,70),width=6)
bd.polygon([(fx+30,fy+40),(fx+55,fy+28),(fx+95,fy+28),(fx+120,fy+40),(fx+132,fy+80),(fx+112,fy+86),(fx+110,fy+178),(fx+40,fy+178),(fx+38,fy+86),(fx+18,fy+80)],fill=(0,122,51))
bd.polygon([(fx+62,fy+28),(fx+75,fy+46),(fx+88,fy+28)],fill=(15,10,8))
bd.text((fx+58,fy+84),"5",fill=(255,255,255),font_size=62)
bd.rectangle([fx+20,fy+208,fx+130,fy+228],fill=(222,180,70)); bd.text((fx+36,fy+209),"SIGNED",fill=(30,20,10),font_size=16)
bg=bg.filter(ImageFilter.GaussianBlur(1.1))
im=Image.composite(src,bg,mask)
neckL,neckR,neckY=300,520,585
shirt=Image.new('RGB',(W,H),(30,90,160)); sd=ImageDraw.Draw(shirt)
for yy in range(560,H,26):
    for xx in range(250,560,26): sd.ellipse([xx,yy,xx+14,yy+14],fill=[(240,200,60),(220,60,90),(250,250,250)][(xx//26+yy//26)%3])
vmask=Image.new('L',(W,H),0); ImageDraw.Draw(vmask).polygon([(neckL+10,neckY-6),(neckR-10,neckY-6),(410,H)],fill=255)
tee=Image.new('L',(W,H),0); tp=tee.load()
for y in range(548,H):
    for x in range(W):
        if mp[x,y]>128: tp[x,y]=255
im=Image.composite(shirt,im,ImageChops.multiply(vmask,tee).filter(ImageFilter.GaussianBlur(1)))
jac=Image.new('RGB',(W,H)); jd=ImageDraw.Draw(jac)
for y in range(H): jd.line([(0,y),(W,y)],fill=(52+int(10*math.sin(y/9)),30+int(6*math.sin(y/9)),20))
im=Image.composite(jac,im,ImageChops.subtract(tee,vmask).filter(ImageFilter.GaussianBlur(1.5)))
d=ImageDraw.Draw(im,'RGBA')
d.polygon([(neckL+10,neckY-6),(380,H),(330,H),(250,700)],fill=(70,42,28,255)); d.polygon([(neckR-10,neckY-6),(440,H),(490,H),(570,700)],fill=(70,42,28,255))
d.line([(neckL+10,neckY-6),(392,H)],fill=(30,16,10,255),width=4); d.line([(neckR-10,neckY-6),(428,H)],fill=(30,16,10,255),width=4)
gold=(222,180,70,255); gold2=(255,226,140,255)
for cx,cy in [(338,352),(466,350)]: d.rounded_rectangle([cx-62,cy-36,cx+62,cy+38],radius=26,fill=(200,170,255,60),outline=gold,width=4)
d.line([(400,342),(404,342)],fill=gold,width=4); d.line([(276,346),(258,352)],fill=gold,width=4); d.line([(528,344),(552,350)],fill=gold,width=4)
def chain(y0,dip,w,x0=290,x1=530):
    pts=[(x0+i*((x1-x0)/40), y0+dip*math.sin(math.pi*i/40)) for i in range(41)]
    d.line(pts,fill=(150,110,30,255),width=w+3,joint='curve'); d.line(pts,fill=gold,width=w,joint='curve')
    for i in range(0,41,2): x,y=pts[i]; d.ellipse([x-w*0.6,y-w*0.6,x+w*0.6,y+w*0.6],fill=gold2)
chain(584,80,10); chain(590,130,7); chain(596,190,5)
pxp,pyp=410,800
for k,c in enumerate([(10,8,30),(70,40,160),(220,80,190),(90,230,255),(255,255,255)]):
    r=50-k*9; d.ellipse([pxp-r*0.8-k*3,pyp-r-k*4,pxp+r*0.8-k*3,pyp+r-k*4],fill=c+(255,))
d.ellipse([pxp-44,pyp-52,pxp+44,pyp+52],outline=gold,width=8)
def star(x,y,R):
    d.polygon([(x+(R if k%2==0 else R*0.22)*math.cos(k*math.pi/4),y+(R if k%2==0 else R*0.22)*math.sin(k*math.pi/4)) for k in range(8)],fill=(255,255,255,240))
for x,y,R in [(462,752,28),(352,830,16),(560,660,18),(200,130,18),(700,360,14)]: star(x,y,R)
im.save(sys.argv[2],'JPEG',quality=88)
