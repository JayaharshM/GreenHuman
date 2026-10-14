import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
export default function Map({ hospitals = [] }) {
  const points = hospitals.filter((h) => h.location?.coordinates?.length === 2);
  const first = points[0]?.location.coordinates;
  return (
    <div className="map-panel">
      <MapContainer
        key={points.map((h) => h._id).join("")}
        center={first ? [first[1], first[0]] : [18.52, 73.85]}
        zoom={points.length === 1 ? 14 : 11}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((h) => (
          <CircleMarker
            key={h._id}
            center={[h.location.coordinates[1], h.location.coordinates[0]]}
            radius={12}
            pathOptions={{
              color: "#9b1c31",
              fillColor: "#e63946",
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Popup>
              <strong>{h.name}</strong>
              <p>{h.address}</p>
              <Link to={`/hospitals/${h._id}`}>View hospital ↗</Link>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <p className="tiny">
        Map tiles are provided by OpenStreetMap. Location is used only for this
        search.
      </p>
    </div>
  );
}
