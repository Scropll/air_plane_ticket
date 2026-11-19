# Wide-body cabin (three.js)

A plain white twin-engine wide-body airliner with no logo or titles, cruising above
a sea of clouds that scrolls forever. The cabin is laid out in real metres, and every
seat is one instance in an `InstancedMesh` that knows its class, row and letter.

## Run

It's a static page: no build step. Three.js r170 loads from jsDelivr via an import map.

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Cabin (nose at z = 0 m, tail at z = 70 m)

| Zone | Stations (m) | Layout | Seats | Rows / letters |
|---|---|---|---|---|
| The Residence | 7.6 – 12.8 | closed 3-room suite: living room, double bedroom, shower | 2 (sofa) | 1A, 1B |
| First | 12.95 – 17.25 | 6 closed suites, 1-1-1, 2.10 m × 1.25 m, sliding doors | 6 | rows 2–3 · A E K |
| Premium Economy | 20.9 – 26.1 | 2-3-2, 0.97 m pitch, 0.50 m seats | 42 | rows 10–15 · AC DEF HK |
| Economy | 29.8 – 57.0 | 3-4-3, 0.79 m pitch, 0.457 m seats | 320 | rows 20–51 · ABC DEFG HJK |

The fuselage is 6.2 m in diameter with the main-deck floor 1.0 m below the centreline.
The wingspan is 64.4 m and the overall length is 70 m.

## Seats as instances

Each class is drawn by one `InstancedMesh` (`seats:Residence`, `seats:First`,
`seats:Premium`, `seats:Economy`). `mesh.userData.seats[instanceId]` holds a `Seat`
with these fields:

```js
{ id: '34K', cabin: 'Economy', cabinCode: 'Y', row: 34, letter: 'K',
  position: 'window', zone: 'Economy (forward)', pitch: 0.79, width: 0.457,
  floor: Vector3, yaw, mesh, instanceId }
```

From the browser console:

```js
cabin.summary()      // { Residence: 2, First: 6, Premium: 42, Economy: 320 }
cabin.findSeat('2E') // Seat
cabin.select('34K')  // highlight it and fly the camera to it
cabin.sit('1A')      // seated eye-level view
cabin.view('exterior' | 'cabin')
```

Deep links: `?view=cabin`, `?seat=12D`, `?view=seat&seat=2A`.

## Views

- **Exterior**: orbit the aircraft while the clouds stream past.
- **Cabin**: the roof peels away (a clipping plane 1.58 m above the floor, applied
  only between the flight-deck bulkhead and the fin). Hover a seat to identify it,
  click to select it, double-click to sit in it.
- **Seat view**: eye height in the selected seat. Drag to look around.

## Files

- `src/dims.js`: the fuselage profile, cabin stations and layout constants
- `src/aircraft.js`: fuselage, wings, engines, empennage, windows, doors, nav lights
- `src/cabin.js`: lining, floors, monuments, The Residence, suites, and the `Seat` class with its instances
- `src/clouds.js`: the endless cloud deck (shader layers that follow the camera) and passing wisps
- `src/main.js`: scene, lighting, camera modes, picking, UI
