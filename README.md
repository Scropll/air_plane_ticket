# 777-300ER cabin (three.js)

A plain white Boeing 777-300ER-sized airliner with no logo or titles, cruising above
a sea of clouds that scrolls forever. The cabin follows the ANA 777-300ER (77W) seat
map in real metres, and every seat is one instance in an `InstancedMesh` that knows
its class, row and letter.

## Run

It's a static page: no build step. Three.js r170 loads from jsDelivr via an import map.

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Cabin: ANA 777-300ER (77W), 212 seats (nose at z = 0 m)

Stations come from the ANA seat map, which is drawn to scale: z = 6.0 m + (map pixel y − 160) × 0.0338 m.
Economy rows land 0.87 m apart, which matches ANA's 34 in pitch.

| Class | Stations (m) | Layout | Seats | Rows / letters |
|---|---|---|---|---|
| First | 10.5 – 14.4 | 1-2-1 "THE Suite": wide charcoal seat, 43 in screen in a dark-wood surround, ottoman, window console, ribbed walls with a sliding door | 8 | rows 1–2 · A D G K |
| Business | 14.5 – 17.7, 21.7 – 35.0, 37.4 – 43.0 | 1-2-1 "THE Room": wide charcoal bench seats that alternate between facing aft (odd rows) and facing forward (even rows), with facing pairs' footwells side by side; ottoman under a 24 in screen, wood-grain-topped console, grey frames with beige wood-grain walls | 64 | rows 5–20 · odd rows A E F K, even rows C D G H |
| Premium Economy | 43.4 – 46.4 | 2-4-2, 1.0 m pitch: grey speckled fabric, winged headrest with a navy cover, fold-down leg rest, consoles with silver trim, 13 in seatback screens, navy carpet | 24 | rows 25–27 · AC DEFG HK |
| Economy | 50.0 – 61.2 | 3-4-3, 0.87 m pitch: royal-blue flecked fabric, winged headrest with a grey leather flap, navy pillow, white armrests and seat-back shell with a 13 in screen, silver legs, dark navy carpet; 2-4-2 in rows 39–41 and A C only in row 42, where the fuselage tapers | 116 | rows 30–42 · ABC DEFG HJK |

The fuselage is 73.9 m long and 6.2 m wide (the cabin is 5.86 m wide), with a 64.8 m wingspan.
The doors are at 8.5, 19.5, 35.2, 49.2 and 62.2 m. The galleys, lavatories, closets and the
bar are placed as on the map.

## Seats as instances

Each class is drawn by one `InstancedMesh` (`seats:First`, `seats:Business`,
`seats:Premium`, `seats:Economy`). `mesh.userData.seats[instanceId]` holds a `Seat`
with these fields:

```js
{ id: '34K', cabin: 'Economy', cabinCode: 'Y', row: 34, letter: 'K',
  position: 'window', zone: 'Economy', pitch: 0.87, width: 0.457,
  floor: Vector3, yaw, mesh, instanceId }
```

From the browser console:

```js
cabin.summary()      // { First: 8, Business: 64, Premium: 24, Economy: 116 }
cabin.findSeat('7E') // Seat
cabin.select('34K')  // highlight it and fly the camera to it
cabin.sit('1A')      // seated eye-level view
cabin.view('exterior' | 'cabin' | 'photo')
```

Deep links: `?view=cabin`, `?seat=26D`, `?view=seat&seat=2A`, and `?view=photo&clean` for a
straight-down aerial frame with no UI or labels.

## Views

- **Exterior**: orbit the aircraft while the clouds stream past.
- **Cabin**: the roof peels away (a clipping plane 1.58 m above the floor, applied
  only between the flight-deck bulkhead and the fin). Hover a seat to identify it,
  click to select it, double-click to sit in it.
- **Top-down**: a straight-down aerial view with the nose at the top. The whole aircraft is in
  frame, the crown is replaced by clear glass, and ambient occlusion is applied. There are no labels.
- **Seat**: eye height in the selected seat. Drag to look around.

## Dusk look and fly-through

`?look=dusk` (the **Dusk** switch in the panel) restyles the scene as a blue-hour drone shot.
The sun sits on the horizon, so the sky runs orange low and deep blue above. The clouds are
lit pink and orange, a row of warm lamps lights the cabin, the windows glow, and the brightest
lights get a soft glow.

`?film&look=dusk&clean` turns the page into a deterministic 8-second, 24 fps shot. It starts
wide on the airliner and pushes in over the First and Business cabins. Then it rises in a
turning diagonal to the straight-down glass-roof view. `window.film.render(i)` renders frame
`i` (call it in order, from 0 to 191) and returns it as a JPEG data URL, so the frames can be
captured headlessly and joined with ffmpeg:

```bash
ffmpeg -framerate 24 -i f%04d.jpg -c:v libx264 -crf 17 -pix_fmt yuv420p flythrough.mp4
```

## Files

- `src/dims.js`: the fuselage profile, cabin stations and layout constants
- `src/aircraft.js`: fuselage, wings, engines, empennage, windows, doors, nav lights
- `src/cabin.js`: lining, floors, monuments, First suites, Business pods, and the `Seat` class with its instances
- `src/clouds.js`: the endless cloud deck (shader layers that follow the camera) and passing wisps
- `src/main.js`: scene, lighting, camera modes, picking, UI
