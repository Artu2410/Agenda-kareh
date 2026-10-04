export const buildOfficialHolidayCalendarFixture = (year = 2026) => ({
  dateModified: '2026-10-02T12:42:31Z',
  mainEntity: {
    itemListElement: [
      {
        item: {
          name: 'Día de la Raza',
          startDate: `${year}-10-12`,
          additionalProperty: { value: 'trasladable' },
          location: { name: 'Argentina' },
        },
      },
      {
        item: {
          name: 'Visita de Su Santidad el Papa León XIV',
          startDate: `${year}-11-09`,
          additionalProperty: { value: 'inamovible' },
          location: { name: 'Argentina' },
        },
      },
      {
        item: {
          name: 'Visita de Su Santidad el Papa León XIV (<a href="/normativa/nacional/norma-430580/texto">feriado en Córdoba y Ciudad Autónoma de Buenos Aires</a>)',
          startDate: `${year}-11-10`,
          additionalProperty: { value: 'especial' },
          location: { name: 'Argentina' },
        },
      },
      {
        item: {
          name: 'Día no laborable con fines turísticos',
          startDate: `${year}-03-23`,
          additionalProperty: { value: 'turistico' },
          location: { name: 'Argentina' },
        },
      },
    ],
  },
});

export const mockOfficialHolidayFeed = (calendar = buildOfficialHolidayCalendarFixture()) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => calendar,
  }));
};
