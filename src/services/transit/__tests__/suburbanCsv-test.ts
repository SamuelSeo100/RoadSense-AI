import { describe, expect, it } from '@jest/globals';

import { parseDays, parseSuburbanCsv } from '../suburbanCsv';

const NAMES = ['Pune Jn', 'Khadki', 'Pimpri', 'Lonavala'];
const HEADER = `train_no,direction,days,${NAMES.join(',')}`;
const csv = (...rows: string[]) => [HEADER, '# comment, ignored', ...rows, ''].join('\n');

describe('parseDays', () => {
  it('understands the template formats', () => {
    expect(parseDays('Daily')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseDays('Mon-Sat')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parseDays('Sun')).toEqual([0]);
    expect(parseDays('Mon;Wed;Fri')).toEqual([1, 3, 5]);
    expect(parseDays('Sat-Mon')).toEqual([0, 1, 6]);
    expect(parseDays('Funday')).toBeNull();
  });
});

describe('parseSuburbanCsv', () => {
  it('converts valid rows, with - for stations not served', () => {
    const { trips, errors } = parseSuburbanCsv(
      csv('99801,UP,Daily,05:00,05:10,-,06:15', '99802,DN,Sun,08:30,07:50,07:40,07:00'),
      NAMES,
    );
    expect(errors).toEqual([]);
    expect(trips).toEqual([
      {
        trainNo: '99801',
        direction: 'UP',
        days: [0, 1, 2, 3, 4, 5, 6],
        times: ['05:00', '05:10', null, '06:15'],
      },
      {
        trainNo: '99802',
        direction: 'DOWN',
        days: [0],
        times: ['08:30', '07:50', '07:40', '07:00'],
      },
    ]);
  });

  it('unwraps midnight into hours ≥ 24', () => {
    const { trips, errors } = parseSuburbanCsv(csv('1,UP,Daily,23:40,23:55,00:05,00:50'), NAMES);
    expect(errors).toEqual([]);
    expect(trips[0]?.times).toEqual(['23:40', '23:55', '24:05', '24:50']);
  });

  it('rejects times that go backwards in the direction of travel', () => {
    const { errors } = parseSuburbanCsv(csv('2,UP,Daily,05:00,04:55,05:10,05:20'), NAMES);
    expect(errors[0]).toMatch(/Khadki 04:55 is earlier/);
    // An UP-ordered row marked DOWN is wrong too.
    expect(
      parseSuburbanCsv(csv('3,DOWN,Daily,05:00,05:10,05:20,05:30'), NAMES).errors,
    ).toHaveLength(1);
  });

  it('requires every station cell (or an explicit -)', () => {
    const { errors } = parseSuburbanCsv(csv('4,UP,Daily,05:00,,05:20,05:30'), NAMES);
    expect(errors).toEqual([
      'line 3 (train 4): Khadki: empty (write - if the train does not stop)',
    ]);
  });

  it('checks the header, column count, direction and days', () => {
    expect(parseSuburbanCsv('train_no,direction,days,Pune Jn,Lonavala\n', NAMES).errors[0]).toMatch(
      /missing column\(s\) Khadki, Pimpri/,
    );
    const { errors } = parseSuburbanCsv(
      csv(
        '5,UP,Daily,05:00,05:10',
        '6,SIDEWAYS,Daily,05:00,05:10,05:20,05:30',
        '7,UP,Someday,05:00,05:10,05:20,05:30',
        '8,UP,Daily,5pm,05:10,05:20,05:30',
      ),
      NAMES,
    );
    expect(errors).toEqual([
      'line 3 (train 5): 5 columns, expected 7',
      'line 4 (train 6): direction "SIDEWAYS" must be UP or DOWN',
      'line 5 (train 7): days "Someday" not understood (Daily, Mon-Sat, Sun, Mon;Wed;Fri)',
      'line 6 (train 8): Pune Jn: "5pm" is not HH:MM',
    ]);
  });

  it('needs at least two stops', () => {
    expect(parseSuburbanCsv(csv('9,UP,Daily,05:00,-,-,-'), NAMES).errors[0]).toMatch(
      /fewer than 2/,
    );
  });
});
