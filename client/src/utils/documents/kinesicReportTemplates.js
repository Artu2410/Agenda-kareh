/**
 * Plantillas del informe kinésico. Cada una define el título, las mediciones de
 * ingreso/egreso y las técnicas que aparecen precargadas (todo editable antes de imprimir).
 */
export const KINESIC_REPORT_TEMPLATES = {
  fkt: {
    id: 'fkt',
    label: 'Kinesiología y fisioterapia (FKT)',
    title: 'Informe Kinésico',
    treatmentIntro: 'kinesiología y rehabilitación kinésica integral',
    metrics: [
      { key: 'pain', label: 'Nivel del Dolor (EVA)', suffix: '/ 10', placeholder: '0-10' },
    ],
    techniques: [
      'Magnetoterapia (MGT)',
      'Electroanalgesia (EA) / TENS',
      'Ultrasonido (US)',
      'Ejercicios Terapéuticos (ET)',
    ],
  },
  respiratory: {
    id: 'respiratory',
    label: 'Kinesiología respiratoria',
    title: 'Informe Kinésico Respiratorio',
    treatmentIntro: 'kinesiología respiratoria',
    metrics: [
      { key: 'dyspnea', label: 'Disnea (escala de Borg)', suffix: '/ 10', placeholder: '0-10' },
      { key: 'spo2', label: 'SpO₂ en reposo', suffix: '%', placeholder: '%' },
    ],
    techniques: [
      'Técnicas de higiene bronquial (drenaje postural, AFE, vibraciones)',
      'Reeducación del patrón ventilatorio y reexpansión pulmonar',
      'Entrenamiento de músculos respiratorios (IMT)',
      'Reacondicionamiento al esfuerzo / ejercicio aeróbico',
    ],
  },
  pelvicFloor: {
    id: 'pelvicFloor',
    label: 'Piso pélvico',
    title: 'Informe Kinésico de Piso Pélvico',
    treatmentIntro: 'rehabilitación de piso pélvico',
    metrics: [
      { key: 'oxford', label: 'Fuerza muscular (Oxford modificada)', suffix: '/ 5', placeholder: '0-5' },
      { key: 'leaks', label: 'Episodios de pérdida por día', suffix: '', placeholder: 'n°' },
    ],
    techniques: [
      'Entrenamiento de la musculatura del piso pélvico (EMPP)',
      'Biofeedback',
      'Electroestimulación / neuromodulación tibial (TENS)',
      'Educación y terapia conductual (diario miccional, hábitos)',
    ],
  },
};

export const KINESIC_REPORT_TEMPLATE_LIST = Object.values(KINESIC_REPORT_TEMPLATES);

/** Sugiere la plantilla según los flags clínicos de la ficha. */
export const suggestTemplateId = (patient = {}) => {
  if (patient.isRespiratory) return 'respiratory';
  if (patient.isIU) return 'pelvicFloor';
  return 'fkt';
};
