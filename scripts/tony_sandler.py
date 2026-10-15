import cv2, numpy as np, sys
K=4
tony=cv2.imread(sys.argv[1]); sand0=cv2.imread(sys.argv[2])
if sand0 is None:
    from PIL import Image; sand0=cv2.cvtColor(np.array(Image.open(sys.argv[2]).convert('RGB')),cv2.COLOR_RGB2BGR)
sand=cv2.resize(sand0,None,fx=K,fy=K,interpolation=cv2.INTER_LANCZOS4)
tp=np.float32([[340,347.5],[467.5,346],[405,470]])
sp=np.float32([[210,72.5],[233.8,71],[223.75,95]])*K
M=cv2.getAffineTransform(tp,sp)
warped=cv2.warpAffine(tony,M,(sand.shape[1],sand.shape[0]),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT)
hull=np.float32([[298,318],[510,314],[524,420],[492,512],[404,546],[316,514],[284,420]])
hs=cv2.transform(hull[None],M)[0].astype(np.int32)
mask=np.zeros(sand.shape[:2],np.uint8); cv2.fillConvexPoly(mask,hs,255)
mask=cv2.erode(mask,np.ones((5,5),np.uint8))
x,y,w,h=cv2.boundingRect(hs); center=(x+w//2,y+h//2)
mode=cv2.MIXED_CLONE if (len(sys.argv)>4 and sys.argv[4]=='mixed') else cv2.NORMAL_CLONE
out=cv2.seamlessClone(warped,sand,mask,center,mode)
# restore sandler's mustache/goatee where his pixels are dark around the mouth & chin
yy,xx=np.mgrid[0:sand.shape[0],0:sand.shape[1]]
lum=cv2.cvtColor(sand,cv2.COLOR_BGR2GRAY).astype(float)
reg=((xx-223.5*K)/(26*K))**2+((yy-104*K)/(17.5*K))**2<=1
mouth=((xx-224.5*K)/(12*K))**2+((yy-95.5*K)/(4.6*K))**2<=1
a=np.where(reg & ~mouth & (lum<90),0.85,0.0)
a=cv2.GaussianBlur(a,(0,0),1.3*K)[...,None]
out=(out*(1-a)+sand*a).astype(np.uint8)
# thin rimless glasses, drawn faint on an overlay
ov=out.copy(); gcol=(175,195,210)
for ex,ey in sp[:2]:
    cv2.ellipse(ov,(int(ex),int(ey+0.3*K)),(int(9.4*K),int(6.2*K)),0,0,360,gcol,max(1,int(0.45*K)),cv2.LINE_AA)
cv2.line(ov,(int(sp[0][0]+9.2*K),int(sp[0][1]-0.8*K)),(int(sp[1][0]-9.2*K),int(sp[1][1]-0.8*K)),gcol,max(1,int(0.45*K)),cv2.LINE_AA)
out=cv2.addWeighted(ov,0.55,out,0.45,0)
out=cv2.resize(out,None,fx=2/K,fy=2/K,interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[3],out,[cv2.IMWRITE_JPEG_QUALITY,90])
print('ok',out.shape)
