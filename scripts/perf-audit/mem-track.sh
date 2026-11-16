#!/bin/bash
# mem-track.sh PID SECONDS INTERVAL OUT: footprint categories every INTERVAL s
pid=$1 secs=$2 iv=$3 out=$4
end=$((SECONDS+secs)); : > "$out"
while [ $SECONDS -lt $end ] && kill -0 $pid 2>/dev/null; do
  f=$(mktemp); footprint -p $pid -j $f >/dev/null 2>&1
  python3 -I -c "
import json,time,sys
p=json.load(open('$f'))['processes'][0]; c=p['categories']
g=lambda k:(c.get(k,{}).get('dirty',0)+c.get(k,{}).get('swapped',0))/1048576
print(f\"{time.strftime('%H:%M:%S')} total {p['footprint']/1048576:.1f} malloc {g('Malloc Small')+g('Malloc Large')+g('Malloc Tiny'):.1f} gfx {g('Owned physical footprint (unmapped) (graphics)')+g('IOAccelerator (graphics)'):.1f} iosurface {g('IOSurface'):.1f} tag1 {g('App-Specific Tag 1'):.1f}\")" >> "$out"
  rm -f $f; sleep $iv
done
