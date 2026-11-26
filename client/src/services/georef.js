// Sugerencias de domicilio con Georef (API oficial de datos.gob.ar, sin clave).
// Solo se envía el texto de la dirección: nunca nombre, DNI ni otros datos del paciente.
export const GEOREF_BASE_URL = 'https://apis.datos.gob.ar/georef/api';
export const MIN_ADDRESS_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;
const RESULTS_PER_AREA = 3;

// Kareh está en Bella Vista (San Miguel). Georef busca en todo el país y devuelve
// coincidencias en cualquier orden, así que se consulta primero la zona de la clínica,
// después el resto de la provincia y CABA, todo en un solo pedido.
const NEARBY_DEPARTMENT_IDS = [
  '06760', // San Miguel
  '06412', // José C. Paz
  '06515', // Malvinas Argentinas
  '06560', // Moreno
  '06638', // Pilar
  '06408', // Hurlingham
  '06410', // Ituzaingó
  '06568', // Morón
  '06371', // General San Martín
  '06840', // Tres de Febrero
  '06805', // Tigre
  '06252', // Escobar
  '06539', // Merlo
  '06756', // San Isidro
  '06749', // San Fernando
  '06861', // Vicente López
];
const SEARCH_AREAS = [
  ...NEARBY_DEPARTMENT_IDS.map((departamento) => ({ departamento })),
  { provincia: '02' }, // CABA
  { provincia: '06' }, // resto de la provincia de Buenos Aires
];

const ADDRESS_FIELDS = 'calle.nombre,altura.valor,localidad_censal.nombre,departamento.nombre,provincia.nombre';
const STREET_FIELDS = 'nombre,localidad_censal.nombre,departamento.nombre,provincia.nombre';

const LOWERCASE_WORDS = new Set(['de', 'del', 'la', 'las', 'los']);

// Georef devuelve todo en mayúsculas ("AV CORRIENTES"): lo pasamos a "Av Corrientes".
export const toTitleCase = (value) => String(value || '')
  .toLowerCase()
  .split(' ')
  .filter(Boolean)
  .map((word, index) => (index > 0 && LOWERCASE_WORDS.has(word)
    ? word
    : word.charAt(0).toUpperCase() + word.slice(1)))
  .join(' ');

// Algunos partidos (San Miguel) anteponen un código interno: "3057 SAN MARTIN".
// Solo se quita un número de 3 o más cifras, así "25 de Mayo" o "9 de Julio" quedan igual.
export const formatStreetName = (value) => toTitleCase(String(value || '').replace(/^\d{3,}\s+(?=\D)/, ''));

const pickName = (value) => (value && typeof value === 'object' ? value.nombre || '' : '');

/** "Localidad, Provincia" sin repetir cuando coinciden (CABA). */
export const buildLocalityLabel = (localityName, provinceName) => {
  const locality = toTitleCase(localityName);
  const province = toTitleCase(provinceName);
  if (!locality) return province;
  if (!province || locality.toLowerCase() === province.toLowerCase()) return locality;
  return `${locality}, ${province}`;
};

const buildLocality = (item) => buildLocalityLabel(
  pickName(item.localidad_censal) || pickName(item.departamento),
  pickName(item.provincia),
);

const mapAddress = (item) => {
  const street = formatStreetName(pickName(item.calle));
  const number = item.altura?.valor;
  const address = [street, number].filter((part) => part !== undefined && part !== null && part !== '').join(' ');
  const locality = buildLocality(item);
  return { address, locality, needsNumber: false, label: [address, locality].filter(Boolean).join(' · ') };
};

const mapStreet = (item) => {
  const street = formatStreetName(item.nombre);
  const locality = buildLocality(item);
  return { address: street, locality, needsNumber: true, label: [street, locality].filter(Boolean).join(' · ') };
};

/**
 * Busca domicilios. Si el texto tiene altura ("Corrientes 1234") busca direcciones;
 * si no, calles, para elegir la calle y después escribir el número.
 * Los resultados vienen ordenados por cercanía a la clínica (zona → CABA → provincia).
 */
export const searchAddressSuggestions = async (query, { signal, fetchImpl = fetch } = {}) => {
  const text = String(query || '').trim();
  if (text.length < MIN_ADDRESS_QUERY_LENGTH) return [];

  const hasNumber = /\d/.test(text);
  const resource = hasNumber ? 'direcciones' : 'calles';
  const body = {
    [resource]: SEARCH_AREAS.map((area) => ({
      ...(hasNumber ? { direccion: text } : { nombre: text }),
      ...area,
      max: RESULTS_PER_AREA,
      campos: hasNumber ? ADDRESS_FIELDS : STREET_FIELDS,
    })),
  };

  const response = await fetchImpl(`${GEOREF_BASE_URL}/${resource}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`Georef respondió ${response.status}`);
  const data = await response.json();

  const mapItem = hasNumber ? mapAddress : mapStreet;
  const items = (data?.resultados || []).flatMap((result) => (result?.[resource] || []).map(mapItem));

  const seen = new Set();
  return items
    .filter((item) => {
      if (!item.address || seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    })
    .slice(0, MAX_SUGGESTIONS);
};
