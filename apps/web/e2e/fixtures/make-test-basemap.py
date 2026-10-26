import gzip, math, sys
from pmtiles.tile import zxy_to_tileid, TileType, Compression
from pmtiles.writer import Writer
import mapbox_vector_tile
from shapely.geometry import box, LineString, Point

W,S,E,N = -0.45, 39.40, -0.30, 39.53   # Valencia area
SEA_LON = -0.33

def tile_bounds(z,x,y):
    n=2**z
    lon1=x/n*360-180; lon2=(x+1)/n*360-180
    def lat(yy): return math.degrees(math.atan(math.sinh(math.pi*(1-2*yy/n))))
    return lon1, lat(y+1), lon2, lat(y)

def tiles():
    for z in range(0,15):
        n=2**z
        def tx(lon): return min(n-1,max(0,int((lon+180)/360*n)))
        def ty(la):
            r=math.radians(la); return min(n-1,max(0,int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*n)))
        for x in range(tx(W),tx(E)+1):
            for y in range(ty(N),ty(S)+1):
                yield z,x,y

out=sys.argv[1]
with open(out,'wb') as f:
    w=Writer(f)
    entries=[]
    for z,x,y in tiles():
        b=tile_bounds(z,x,y)
        tb=box(*b)
        land=tb.intersection(box(-180,-85,SEA_LON,85))
        sea=tb.intersection(box(SEA_LON,-85,180,85))
        layers=[]
        if not land.is_empty: layers.append({'name':'earth','features':[{'geometry':land,'properties':{'kind':'earth'}}]})
        if not sea.is_empty: layers.append({'name':'water','features':[{'geometry':sea,'properties':{'kind':'ocean'}}]})
        roads=[]
        for i in range(8):
            lat=S+(N-S)*i/7
            roads.append({'geometry':LineString([(W,lat),(SEA_LON,lat)]).intersection(tb),'properties':{'kind':'major_road','min_zoom':6}})
            lon=W+(SEA_LON-W)*i/7
            roads.append({'geometry':LineString([(lon,S),(lon,N)]).intersection(tb),'properties':{'kind':'minor_road','min_zoom':10}})
        roads=[r for r in roads if not r['geometry'].is_empty]
        if roads: layers.append({'name':'roads','features':roads})
        p=Point(-0.3763,39.4699)
        if tb.contains(p): layers.append({'name':'places','features':[{'geometry':p,'properties':{'kind':'locality','name':'Valencia','name:es':'Valencia','min_zoom':4,'population_rank':12}}]})
        # One public service, for the services layer: a hospital a little north-east of the centre.
        h=Point(-0.3700,39.4750)
        if z>=14 and tb.contains(h): layers.append({'name':'pois','features':[{'geometry':h,'properties':{'kind':'hospital','name':'Hospital de Prueba','min_zoom':14}}]})
        mvt=mapbox_vector_tile.encode(layers, default_options={'quantize_bounds':b,'extents':4096})
        entries.append((zxy_to_tileid(z,x,y), gzip.compress(mvt)))
    for tid,data in sorted(entries):
        w.write_tile(tid,data)
    w.finalize({'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_zoom':0,'max_zoom':14,
        'min_lon_e7':int(W*1e7),'min_lat_e7':int(S*1e7),'max_lon_e7':int(E*1e7),'max_lat_e7':int(N*1e7),
        'center_zoom':12,'center_lon_e7':int(-0.38*1e7),'center_lat_e7':int(39.47*1e7)},
        {'name':'synthetic test basemap','vector_layers':[]})
    print(len(entries),'tiles')
