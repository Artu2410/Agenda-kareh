import { PrismaClient } from '@prisma/client';
import { getMetrics } from './src/controllers/metrics.controller.js';
import { getCapacityMetrics } from './src/controllers/capacity.controller.js';

const prisma = new PrismaClient();

async function run() {
  const req = { query: {} };
  
  console.log('--- METRICS CONTROLLER ---');
  let metricsRes = null;
  const res1 = {
    json: (data) => { metricsRes = data; }
  };
  await getMetrics(req, res1, prisma);
  
  console.log('Monthly Capacity:', metricsRes.monthly.capacityMonthly.toFixed(2));
  console.log('Occupancy Rate:', metricsRes.monthly.occupancyRate.toFixed(2) + '%');
  console.log('Appointments Count (Valid):', metricsRes.monthly.current);
  
  console.log('\n--- BILLING BY COVERAGE ---');
  metricsRes.billingByCoverage.forEach(b => {
    console.log(`${b.name}: ${b.patients} patients, ${b.turns} turns, Amount: $${b.amount}`);
  });

  console.log('\n--- INSIGHTS ---');
  metricsRes.insights.forEach(i => console.log(i));

  console.log('\n--- CAPACITY CONTROLLER ---');
  let capacityRes = null;
  const res2 = {
    status: () => ({
      json: (data) => { capacityRes = data; }
    })
  };
  await getCapacityMetrics(req, res2, prisma);
  
  console.log('Monthly Capacity:', capacityRes.currentMonth.monthlyCapacity.toFixed(2));
  console.log('Occupancy Rate:', capacityRes.currentMonth.occupancyRate.toFixed(2) + '%');
  console.log('Appointments Count (Valid):', capacityRes.currentMonth.appointmentCount);
  
  await prisma.$disconnect();
}

run().catch(console.error);
