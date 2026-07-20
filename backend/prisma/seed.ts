import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  faker,
  fakerEN_US,
  fakerEN_IN,
  fakerEN_GB,
  fakerDE,
} from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { EmployeeStatus, SalaryChangeReason } from '../generated/prisma/enums';

// Fixed seed so every run produces the exact same dataset (see idempotency note below).
const SEED = 20260719;
faker.seed(SEED);
fakerEN_US.seed(SEED);
fakerEN_IN.seed(SEED + 1);
fakerEN_GB.seed(SEED + 2);
fakerDE.seed(SEED + 3);

const TOTAL_EMPLOYEES = 10_000;
const BATCH_SIZE = 1000;
const NOW = new Date();

type LevelIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Base annual salary in USD by level, before department/country/title adjustment.
// Index 7 (exec) is only used by the Executive department.
const BASE_USD_BY_LEVEL: Record<LevelIndex, number> = {
  0: 52_000,
  1: 72_000,
  2: 100_000,
  3: 125_000,
  4: 145_000,
  5: 185_000,
  6: 240_000,
  7: 320_000,
};

// Org pyramid: most headcount sits in junior/mid IC levels, very little at VP.
const LEVEL_WEIGHTS = [20, 30, 25, 12, 8, 4, 1];

interface Department {
  name: string;
  weight: number;
  multiplier: number;
  /** Titles for levels 0-6 (Executive dept overrides this with `execTitles`). */
  titles: string[];
  execTitles?: { title: string; multiplier: number }[];
}

const DEPARTMENTS: Department[] = [
  {
    name: 'Engineering',
    weight: 32,
    multiplier: 1.15,
    titles: [
      'Junior Software Engineer',
      'Software Engineer',
      'Senior Software Engineer',
      'Staff Software Engineer',
      'Engineering Manager',
      'Director of Engineering',
      'VP of Engineering',
    ],
  },
  {
    name: 'Sales',
    weight: 16,
    multiplier: 0.95,
    titles: [
      'Sales Development Representative',
      'Account Executive',
      'Senior Account Executive',
      'Key Account Manager',
      'Sales Manager',
      'Director of Sales',
      'VP of Sales',
    ],
  },
  {
    name: 'Customer Support',
    weight: 13,
    multiplier: 0.75,
    titles: [
      'Support Associate',
      'Support Specialist',
      'Senior Support Specialist',
      'Support Team Lead',
      'Support Manager',
      'Director of Customer Support',
      'VP of Customer Support',
    ],
  },
  {
    name: 'Operations',
    weight: 11,
    multiplier: 0.85,
    titles: [
      'Operations Coordinator',
      'Operations Analyst',
      'Senior Operations Analyst',
      'Operations Team Lead',
      'Operations Manager',
      'Director of Operations',
      'VP of Operations',
    ],
  },
  {
    name: 'Marketing',
    weight: 8,
    multiplier: 0.92,
    titles: [
      'Marketing Coordinator',
      'Marketing Specialist',
      'Senior Marketing Specialist',
      'Marketing Team Lead',
      'Marketing Manager',
      'Director of Marketing',
      'VP of Marketing',
    ],
  },
  {
    name: 'Product',
    weight: 7,
    multiplier: 1.12,
    titles: [
      'Associate Product Manager',
      'Product Manager',
      'Senior Product Manager',
      'Group Product Manager',
      'Principal Product Manager',
      'Director of Product',
      'VP of Product',
    ],
  },
  {
    name: 'Finance',
    weight: 6,
    multiplier: 1.05,
    titles: [
      'Financial Analyst',
      'Senior Financial Analyst',
      'Finance Manager',
      'Senior Finance Manager',
      'Controller',
      'Director of Finance',
      'VP of Finance',
    ],
  },
  {
    name: 'HR',
    weight: 4,
    multiplier: 0.9,
    titles: [
      'HR Coordinator',
      'HR Business Partner',
      'Senior HR Business Partner',
      'HR Team Lead',
      'HR Manager',
      'Director of HR',
      'VP of HR',
    ],
  },
  {
    name: 'Legal',
    weight: 2,
    multiplier: 1.08,
    titles: [
      'Legal Associate',
      'Legal Counsel',
      'Senior Legal Counsel',
      'Lead Counsel',
      'Legal Manager',
      'Director of Legal',
      'General Counsel',
    ],
  },
  {
    name: 'Executive',
    weight: 1,
    multiplier: 1.25,
    titles: [],
    execTitles: [
      { title: 'Chief Executive Officer', multiplier: 1.3 },
      { title: 'Chief Operating Officer', multiplier: 1.1 },
      { title: 'Chief Financial Officer', multiplier: 1.1 },
      { title: 'Chief Technology Officer', multiplier: 1.1 },
      { title: 'Chief Product Officer', multiplier: 1.05 },
      { title: 'Chief People Officer', multiplier: 1.0 },
      { title: 'Chief Marketing Officer', multiplier: 1.0 },
      { title: 'General Counsel', multiplier: 1.0 },
    ],
  },
];

interface CountryConfig {
  name: string;
  currency: string;
  weight: number;
  /** Local market rate relative to the USD base bands, already includes FX. */
  factor: number;
  nameFaker: typeof fakerEN_US;
}

const COUNTRIES: CountryConfig[] = [
  {
    name: 'United States',
    currency: 'USD',
    weight: 28,
    factor: 1.0,
    nameFaker: fakerEN_US,
  },
  {
    name: 'India',
    currency: 'INR',
    weight: 30,
    factor: 11.0,
    nameFaker: fakerEN_IN,
  },
  {
    name: 'United Kingdom',
    currency: 'GBP',
    weight: 16,
    factor: 0.62,
    nameFaker: fakerEN_GB,
  },
  {
    name: 'Germany',
    currency: 'EUR',
    weight: 14,
    factor: 0.82,
    nameFaker: fakerDE,
  },
  // No dedicated Singapore locale in faker; English is Singapore's working
  // language so we reuse the US name generator rather than mis-romanizing.
  {
    name: 'Singapore',
    currency: 'SGD',
    weight: 12,
    factor: 1.25,
    nameFaker: fakerEN_US,
  },
];

const STATUS_WEIGHTS: [EmployeeStatus, number][] = [
  [EmployeeStatus.ACTIVE, 92],
  [EmployeeStatus.INACTIVE, 3],
  [EmployeeStatus.TERMINATED, 5],
];

const REASON_WEIGHTS: [SalaryChangeReason, number][] = [
  [SalaryChangeReason.HIKE, 70],
  [SalaryChangeReason.ADJUSTMENT, 25],
  [SalaryChangeReason.CORRECTION, 5],
];

function weightedPick<T>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}

function weightedIndex(weights: number[]): number {
  return weightedPick(weights.map((w, i) => [i, w] as [number, number]));
}

function randomInRange(min: number, max: number): number {
  return faker.number.float({ min, max });
}

function round2(value: number): string {
  return value.toFixed(2);
}

/** Recency-weighted hire date: headcount has grown, so recent hires dominate. */
function randomHireDate(): Date {
  const bucket = weightedPick<[number, number]>([
    [[90, 3 * 365], 55],
    [[3 * 365, 6 * 365], 30],
    [[6 * 365, 9 * 365], 15],
  ]);
  const [minDays, maxDays] = bucket;
  const daysAgo = faker.number.int({ min: minDays, max: maxDays });
  return new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

function salaryBand(
  levelIndex: LevelIndex,
  deptMultiplier: number,
  countryFactor: number,
  titleMultiplier: number,
) {
  const mid =
    BASE_USD_BY_LEVEL[levelIndex] *
    deptMultiplier *
    titleMultiplier *
    countryFactor;
  return { min: mid * 0.85, mid, max: mid * 1.15 };
}

/** Strictly increasing dates from hireDate to now, hireDate first. */
function spreadDates(hireDate: Date, count: number): Date[] {
  const dates = [hireDate];
  if (count === 1) return dates;
  const totalMs = Math.max(NOW.getTime() - hireDate.getTime(), 1);
  const offsets = Array.from({ length: count - 1 }, () =>
    faker.number.float({ min: 0, max: 1 }),
  ).sort((a, b) => a - b);
  for (const offset of offsets) {
    dates.push(new Date(hireDate.getTime() + offset * totalMs));
  }
  return dates;
}

const usedEmails = new Map<string, number>();

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  return slug || 'user';
}

function makeEmail(fullName: string): string {
  const [first, ...rest] = fullName.split(' ');
  const base = `${slugify(first)}.${slugify(rest.join(' ') || first)}`;
  const count = usedEmails.get(base) ?? 0;
  usedEmails.set(base, count + 1);
  return count === 0 ? `${base}@acme.com` : `${base}${count + 1}@acme.com`;
}

interface GeneratedEmployee {
  employeeRow: {
    id: string;
    name: string;
    email: string;
    department: string;
    country: string;
    currency: string;
    jobTitle: string;
    status: EmployeeStatus;
    hireDate: Date;
  };
  salaryRows: {
    id: string;
    employeeId: string;
    amount: string;
    currency: string;
    effectiveDate: Date;
    reason: SalaryChangeReason;
  }[];
}

function generateEmployee(): GeneratedEmployee {
  const department = weightedPick(
    DEPARTMENTS.map((d) => [d, d.weight] as [Department, number]),
  );
  const country = weightedPick(
    COUNTRIES.map((c) => [c, c.weight] as [CountryConfig, number]),
  );

  let levelIndex: LevelIndex;
  let jobTitle: string;
  let titleMultiplier: number;

  if (department.execTitles) {
    levelIndex = 7;
    const pick = faker.helpers.arrayElement(department.execTitles);
    jobTitle = pick.title;
    titleMultiplier = pick.multiplier;
  } else {
    levelIndex = weightedIndex(LEVEL_WEIGHTS) as LevelIndex;
    jobTitle = department.titles[levelIndex];
    titleMultiplier = 1;
  }

  const name = `${country.nameFaker.person.firstName()} ${country.nameFaker.person.lastName()}`;
  const email = makeEmail(name);
  const hireDate = randomHireDate();
  const status = weightedPick(STATUS_WEIGHTS);
  const employeeId = randomUUID();

  const numRecords = faker.number.int({ min: 2, max: 4 });
  const maxPromotions = Math.min(levelIndex, numRecords - 1, 2);
  const promotions =
    maxPromotions > 0
      ? weightedIndex(
          Array.from({ length: maxPromotions + 1 }, (_, i) => 3 - i),
        )
      : 0;
  const startLevel = Math.max(0, levelIndex - promotions) as LevelIndex;

  const dates = spreadDates(hireDate, numRecords);
  const salaryRows: GeneratedEmployee['salaryRows'] = [];

  let currentLevel = startLevel;
  const startBand = salaryBand(
    startLevel,
    department.multiplier,
    country.factor,
    titleMultiplier,
  );
  let currentAmount = randomInRange(startBand.min, startBand.mid);

  salaryRows.push({
    id: randomUUID(),
    employeeId,
    amount: round2(currentAmount),
    currency: country.currency,
    effectiveDate: dates[0],
    reason: SalaryChangeReason.JOINING,
  });

  let remainingPromotions = promotions;
  for (let i = 1; i < numRecords; i++) {
    const promoteNow =
      remainingPromotions > 0 &&
      (i === numRecords - 1 || faker.number.float({ min: 0, max: 1 }) < 0.6);
    let reason: SalaryChangeReason;

    if (promoteNow) {
      reason = SalaryChangeReason.PROMOTION;
      currentLevel = Math.min(6, currentLevel + 1) as LevelIndex;
      remainingPromotions--;
      const band = salaryBand(
        currentLevel,
        department.multiplier,
        country.factor,
        titleMultiplier,
      );
      currentAmount = Math.max(
        currentAmount * 1.12,
        randomInRange(band.min, band.mid),
      );
    } else {
      reason = weightedPick(REASON_WEIGHTS);
      if (reason === SalaryChangeReason.HIKE) {
        currentAmount *= randomInRange(1.03, 1.08);
      } else if (reason === SalaryChangeReason.ADJUSTMENT) {
        currentAmount *= randomInRange(1.02, 1.06);
      } else {
        currentAmount *= randomInRange(0.97, 1.02);
      }
    }

    salaryRows.push({
      id: randomUUID(),
      employeeId,
      amount: round2(currentAmount),
      currency: country.currency,
      effectiveDate: dates[i],
      reason,
    });
  }

  return {
    employeeRow: {
      id: employeeId,
      name,
      email,
      department: department.name,
      country: country.name,
      currency: country.currency,
      jobTitle,
      status,
      hireDate,
    },
    salaryRows,
  };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Wipe-and-reseed with a fixed faker seed makes this idempotent: every run
    // ends with the exact same 10,000 employees and salary history, and we
    // never hit unique-email collisions from a previous partial run.
    console.log('Clearing existing seed data...');
    await prisma.salaryRecord.deleteMany();
    await prisma.employee.deleteMany();

    let seededEmployees = 0;
    let seededSalaryRecords = 0;

    for (
      let batchStart = 0;
      batchStart < TOTAL_EMPLOYEES;
      batchStart += BATCH_SIZE
    ) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_EMPLOYEES - batchStart);
      const employeeRows: GeneratedEmployee['employeeRow'][] = [];
      const salaryRows: GeneratedEmployee['salaryRows'] = [];

      for (let i = 0; i < batchSize; i++) {
        const { employeeRow, salaryRows: rows } = generateEmployee();
        employeeRows.push(employeeRow);
        salaryRows.push(...rows);
      }

      await prisma.employee.createMany({ data: employeeRows });
      await prisma.salaryRecord.createMany({ data: salaryRows });

      seededEmployees += employeeRows.length;
      seededSalaryRecords += salaryRows.length;
      console.log(
        `Seeded ${seededEmployees}/${TOTAL_EMPLOYEES} employees (${seededSalaryRecords} salary records so far)`,
      );
    }

    console.log(
      `Done. ${seededEmployees} employees, ${seededSalaryRecords} salary records.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
