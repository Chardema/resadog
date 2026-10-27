import assert from 'node:assert/strict';
import { calculateBookingPrice, getLastMinuteFee } from '../src/lib/pricing';
import { parisAppointment } from '../src/lib/booking-dates';
import { selectBestBookingDiscount } from '../src/lib/booking-discounts';

const now = new Date('2026-09-13T08:00:00Z'); // 10:00 Paris
const dog = { id: 'dog', species: 'DOG' as const, age: 4 };
const cat = { id: 'cat', species: 'CAT' as const, age: 4 };
for (const serviceType of ['BOARDING', 'DAY_CARE', 'HOUSE_SITTING', 'DROP_IN', 'DOG_WALKING']) {
  const input = { serviceType, pets: [dog], startDate: '2026-09-13', endDate: serviceType === 'BOARDING' ? '2026-09-14' : '2026-09-13', startTime: '18:00', endTime: '19:00', visitSlots: [{ date: '2026-09-13', startTime: '18:00', duration: 30 }], requestedAt: now };
  const normal = calculateBookingPrice({ ...input, requestedAt: new Date('2026-09-10T08:00:00Z') });
  const urgent = calculateBookingPrice(input);
  assert.equal(urgent.total, normal.total + 10, serviceType);
  assert.equal(urgent.lastMinuteFee, 10, serviceType);
  const group = calculateBookingPrice({ ...input, pets: [dog, { ...dog, id: 'dog2' }] });
  assert.equal(group.lastMinuteFee, 10, `${serviceType} multiple pets`);
}
const boundary = { serviceType: 'DAY_CARE', startDate: '2026-09-14', startTime: '10:00', requestedAt: now };
assert.equal(getLastMinuteFee(boundary), 0, 'exactly 24 hours');
assert.equal(getLastMinuteFee({ ...boundary, requestedAt: new Date(now.getTime() + 1) }), 10, '24 hours minus one millisecond');
assert.equal(getLastMinuteFee({ ...boundary, requestedAt: new Date(now.getTime() - 1) }), 0, '24 hours plus one millisecond');
assert.equal(getLastMinuteFee({ ...boundary, startDate: '2026-09-12' }), 0, 'past');
assert.equal(getLastMinuteFee({ ...boundary, startTime: '' }), 0, 'unknown time in quote');
const visits = calculateBookingPrice({ serviceType: 'DROP_IN', pets: [cat, { ...cat, id: 'cat2' }], startDate: '2026-09-13', endDate: '2026-09-20', visitSlots: [{ date: '2026-09-20', startTime: '10:00', duration: 30 }, { date: '2026-09-13', startTime: '18:00', duration: 30 }, { date: '2026-09-14', startTime: '09:00', duration: 30 }], requestedAt: now });
assert.equal(visits.total, 55, 'three shared visits, two cats, one fee');
assert.equal(visits.lastMinuteFee, 10, 'earliest slot despite unsorted input');
const stay = calculateBookingPrice({ serviceType: 'BOARDING', pets: [dog], startDate: '2026-09-13', endDate: '2026-09-16', startTime: '18:00', endTime: '18:00', requestedAt: now });
assert.equal(stay.total, 145, 'three day stay, one fee');
assert.equal(selectBestBookingDiscount({ originalAmount: stay.total - stay.lastMinuteFee, automaticFinalAmount: stay.total - stay.lastMinuteFee, isPremium: true }).finalAmount + stay.lastMinuteFee, 131.5, 'fee remains ten euros after Premium');
assert.equal(parisAppointment('2026-01-10', '12:00')?.toISOString(), '2026-01-10T11:00:00.000Z');
assert.equal(parisAppointment('2026-07-10', '12:00')?.toISOString(), '2026-07-10T10:00:00.000Z');
assert.equal(parisAppointment('2026-03-29', '02:30'), null, 'nonexistent DST hour');
assert.equal(getLastMinuteFee({ ...boundary, startDate: '2026-03-29', startTime: '12:00', requestedAt: new Date('2026-03-28T10:30:00Z') }), 10, 'spring DST real 23.5 hours');
assert.equal(getLastMinuteFee({ ...boundary, startDate: '2026-10-25', startTime: '12:00', requestedAt: new Date('2026-10-24T10:30:00Z') }), 0, 'autumn DST real 24.5 hours');
console.log('OK — last-minute fee: all five services, groups, slots, 24h boundary, Paris DST, discounts.');
