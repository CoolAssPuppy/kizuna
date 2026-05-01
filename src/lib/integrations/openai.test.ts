import { describe, expect, it, vi } from 'vitest';

import { ITINERARY_PARSER_PROMPT, openAIStatus, parseItineraryText } from './openai';

describe('openai integration', () => {
  it('reports stubbed mode when no API key is set', () => {
    expect(openAIStatus({})).toEqual({ mode: 'stubbed', reason: 'OPENAI_API_KEY missing' });
  });

  it('reports live mode when API key is set', () => {
    expect(openAIStatus({ apiKey: 'sk-test' })).toEqual({ mode: 'live' });
  });

  it('returns an empty ParsedItinerary in stubbed mode', async () => {
    const result = await parseItineraryText({}, 'Some forwarded confirmation email');
    expect(result.flights).toEqual([]);
    expect(result.hotels).toEqual([]);
    expect(result.rental_cars).toEqual([]);
    expect(result.car_services).toEqual([]);
  });

  it('parses a live OpenAI JSON response into a normalised shape', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    flights: [
                      {
                        airline: 'Air Canada',
                        airline_icao: 'ACA',
                        flight_number: '142',
                        confirmation_number: 'ABC123',
                        departure_airport: 'SFO',
                        arrival_airport: 'YYC',
                        departure_time_local: '2027-04-12T08:30:00',
                        arrival_time_local: '2027-04-12T11:45:00',
                        seat_class: 'Economy',
                        seat_number: '12A',
                        status: 'CONFIRMED',
                        terminal_departure: '1',
                        terminal_arrival: 'A',
                      },
                    ],
                    hotels: [
                      {
                        confirmation_number: 'H-9',
                        lodging_name: 'Banff Springs Hotel',
                        city: 'Banff',
                        address: '405 Spray Ave',
                        check_in_time_local: '2027-04-12T15:00:00',
                        check_out_time_local: '2027-04-15T11:00:00',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      } as Response),
    );

    const result = await parseItineraryText({ apiKey: 'sk-test', fetchImpl }, 'forwarded email');

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.airline_icao).toBe('ACA');
    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0]?.lodging_name).toBe('Banff Springs Hotel');
    // Missing categories default to empty arrays so the UI can iterate safely.
    expect(result.rental_cars).toEqual([]);
    expect(result.car_services).toEqual([]);
  });

  it('throws with the API error body when the OpenAI call fails', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid key'),
      } as Response),
    );

    await expect(parseItineraryText({ apiKey: 'sk-bad', fetchImpl }, 'text')).rejects.toThrow(
      /OpenAI parse failed \(401\): Invalid key/,
    );
  });

  it('exposes a non-empty parser prompt for the edge function to share', () => {
    expect(ITINERARY_PARSER_PROMPT).toContain('travel itinerary parser');
    expect(ITINERARY_PARSER_PROMPT).toContain('flights');
    expect(ITINERARY_PARSER_PROMPT).toContain('hotels');
    expect(ITINERARY_PARSER_PROMPT).toContain('rental_cars');
    expect(ITINERARY_PARSER_PROMPT).toContain('car_services');
    expect(ITINERARY_PARSER_PROMPT).toContain('airline_icao');
  });
});
