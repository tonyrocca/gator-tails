import cv2, numpy as np, sys
from PIL import Image, ImageDraw, ImageFont
src=cv2.imread(sys.argv[1]); dst=cv2.imread(sys.argv[2]); H,W=dst.shape[:2]
tp=np.float32([[126.7,570],[288,560],[230,766.7]])
dp=np.float32([[275,333],[409,291],[405,437]])
M=cv2.getAffineTransform(tp,dp)
warp=cv2.warpAffine(src,M,(W,H),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT).astype(np.float32)
# brim shadow on the warped face
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def brim(x): return 322+(280-322)*(x-275)/(409-275)
dist=yy-brim(xx)
shade=np.clip(0.62+0.38*(dist/60.0),0.62,1.0)[...,None]
warp=np.clip(warp*shade,0,255).astype(np.uint8)
poly=np.int32([[258,345],[300,326],[410,292],[452,284],[480,330],[484,420],[458,470],[402,488],[330,468],[272,414],[250,372]])
mask=np.zeros((H,W),np.uint8); cv2.fillPoly(mask,[poly],255)
mask[dist<6]=0
mask=cv2.erode(mask,np.ones((5,5),np.uint8))
# Reinhard color transfer (LAB) from destination face to warped Reece, then feathered alpha blend
lab_w=cv2.cvtColor(warp,cv2.COLOR_BGR2LAB).astype(np.float32); lab_d=cv2.cvtColor(dst,cv2.COLOR_BGR2LAB).astype(np.float32)
mm=mask>0
for c in range(3):
    a=lab_w[...,c]; b=lab_d[...,c]
    k=0.75 if c==0 else 1.0
    a[:]=(a-a[mm].mean())/(a[mm].std()+1e-6)*(b[mm].std()*k+a[mm].std()*(1-k))+b[mm].mean()
warp2=cv2.cvtColor(np.clip(lab_w,0,255).astype(np.uint8),cv2.COLOR_LAB2BGR)
alpha=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),7)[...,None]
out=(warp2*alpha+dst*(1-alpha)).astype(np.uint8)
# shirt: erase old text and reprint
g=cv2.cvtColor(out,cv2.COLOR_BGR2GRAY)
tm=np.zeros((H,W),np.uint8); tm[595:800,225:680]=255
txt=((g<120)&(tm>0)).astype(np.uint8)*255
txt=cv2.dilate(txt,np.ones((7,7),np.uint8))
out=cv2.inpaint(out,txt,9,cv2.INPAINT_TELEA)
img=Image.fromarray(cv2.cvtColor(out,cv2.COLOR_BGR2RGB)); d=ImageDraw.Draw(img)
font=ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc',37,index=1)
lines=["I start three Browns","and I need help","immediately."]
for i,l in enumerate(lines):
    w_=d.textlength(l,font=font); d.text((452-w_/2,612+i*62),l,font=font,fill=(28,28,30))
img.save(sys.argv[3],quality=90)
print('ok')
