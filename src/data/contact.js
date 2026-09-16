export const CONTACT = Object.freeze({
  email: "info@gaurishiksha.com",
  phoneDisplay: "+91 99536 59468",
  phoneHref: "+919953659468",
  whatsapp: "919953659468",
  instagram: "https://www.instagram.com/prometheussportsacademy/",
  venue: "Prometheus School, Noida",
  address: "Prometheus School, Sector 131, Noida, Uttar Pradesh",
});

const PROMETHEUS_SCHOOL_COORDINATES = "28.5127038,77.3601964";

export const MAP_EMBED_URL = `https://www.google.com/maps?q=${PROMETHEUS_SCHOOL_COORDINATES}&z=17&output=embed`;
export const MAP_DIRECTIONS_URL = "https://maps.app.goo.gl/JgxTNw3R4N9dhr9t6";

export function whatsappUrl(message) {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
}
