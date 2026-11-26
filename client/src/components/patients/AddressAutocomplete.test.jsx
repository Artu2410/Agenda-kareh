import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import AddressAutocomplete from './AddressAutocomplete';
import { server } from '../../tests/msw/server';
import { buildLocalityLabel, formatStreetName, searchAddressSuggestions, toTitleCase } from '../../services/georef';

const GEOREF = 'https://apis.datos.gob.ar/georef/api';

const direccionCorrientes = {
  calle: { nombre: 'AV CORRIENTES' },
  altura: { valor: 1234 },
  localidad_censal: { nombre: 'Ciudad Autónoma de Buenos Aires' },
  departamento: { nombre: 'Comuna 1' },
  provincia: { nombre: 'Ciudad Autónoma de Buenos Aires' },
};

const calleSanMartin = {
  nombre: 'SAN MARTIN',
  localidad_censal: { nombre: 'Moreno' },
  departamento: { nombre: 'Moreno' },
  provincia: { nombre: 'Buenos Aires' },
};

function Harness({ initial = {} }) {
  const [value, setValue] = useState({ address: '', locality: '', ...initial });
  return (
    <AddressAutocomplete
      address={value.address}
      locality={value.locality}
      onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
    />
  );
}

describe('georef', () => {
  it('formatea nombres y localidad sin repetir la provincia', () => {
    expect(toTitleCase('AV DE MAYO')).toBe('Av de Mayo');
    expect(formatStreetName('3057 SAN MARTIN')).toBe('San Martin');
    expect(formatStreetName('25 DE MAYO')).toBe('25 de Mayo');
    expect(formatStreetName('AV E PERON')).toBe('Av E Peron');
    expect(buildLocalityLabel('MORENO', 'BUENOS AIRES')).toBe('Moreno, Buenos Aires');
    expect(buildLocalityLabel('Ciudad Autónoma de Buenos Aires', 'Ciudad Autónoma de Buenos Aires'))
      .toBe('Ciudad Autónoma de Buenos Aires');
  });

  it('consulta en un solo pedido, primero la zona de la clínica y después CABA y provincia', async () => {
    const bodies = {};
    server.use(
      http.post(`${GEOREF}/direcciones`, async ({ request }) => {
        bodies.direcciones = await request.json();
        return HttpResponse.json({ resultados: [{ direcciones: [] }, { direcciones: [direccionCorrientes] }] });
      }),
      http.post(`${GEOREF}/calles`, async ({ request }) => {
        bodies.calles = await request.json();
        return HttpResponse.json({ resultados: [{ calles: [calleSanMartin] }] });
      }),
    );

    const [address] = await searchAddressSuggestions('corrientes 1234');
    expect(address).toMatchObject({ address: 'Av Corrientes 1234', locality: 'Ciudad Autónoma de Buenos Aires', needsNumber: false });
    const queries = bodies.direcciones.direcciones;
    expect(queries[0]).toMatchObject({ direccion: 'corrientes 1234', departamento: '06760' }); // San Miguel
    expect(queries.slice(-2).map((item) => item.provincia)).toEqual(['02', '06']);

    const [street] = await searchAddressSuggestions('san martin');
    expect(street).toMatchObject({ address: 'San Martin', locality: 'Moreno, Buenos Aires', needsNumber: true });
    expect(bodies.calles.calles[0]).toMatchObject({ nombre: 'san martin' });

    expect(await searchAddressSuggestions('ab')).toEqual([]);
  });
});

describe('AddressAutocomplete', () => {
  it('al elegir una sugerencia completa dirección y localidad', async () => {
    server.use(
      http.post(`${GEOREF}/direcciones`, () => HttpResponse.json({ resultados: [{ direcciones: [direccionCorrientes] }] })),
    );
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Dirección' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'corrientes 1234' } });

    const option = await screen.findByRole('option', {}, { timeout: 2000 });
    fireEvent.mouseDown(option);

    expect(input).toHaveValue('Av Corrientes 1234');
    expect(screen.getByLabelText('Localidad')).toHaveValue('Ciudad Autónoma de Buenos Aires');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('con teclado: Enter elige la sugerencia marcada', async () => {
    server.use(
      http.post(`${GEOREF}/calles`, () => HttpResponse.json({ resultados: [{ calles: [calleSanMartin] }] })),
    );
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Dirección' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'san martin' } });
    await screen.findByRole('option', {}, { timeout: 2000 });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Calle sin altura: deja un espacio para escribir el número.
    expect(input).toHaveValue('San Martin ');
    expect(screen.getByLabelText('Localidad')).toHaveValue('Moreno, Buenos Aires');
  });

  it('si el servicio falla se puede escribir a mano', async () => {
    server.use(
      http.post(`${GEOREF}/calles`, () => HttpResponse.json({}, { status: 500 })),
    );
    render(<Harness initial={{ locality: 'Merlo' }} />);

    const input = screen.getByRole('combobox', { name: 'Dirección' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'pasaje sin nombre' } });

    expect(await screen.findByText(/escribila a mano/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(input).toHaveValue('pasaje sin nombre');
    expect(screen.getByLabelText('Localidad')).toHaveValue('Merlo');
  });

  it('no consulta el servicio por un valor cargado desde la ficha', async () => {
    let calls = 0;
    server.use(
      http.post(`${GEOREF}/direcciones`, () => { calls += 1; return HttpResponse.json({ resultados: [] }); }),
    );
    render(<Harness initial={{ address: 'Av Corrientes 1234', locality: 'CABA' }} />);

    await new Promise((resolve) => { setTimeout(resolve, 600); });
    await waitFor(() => expect(calls).toBe(0));
  });
});
