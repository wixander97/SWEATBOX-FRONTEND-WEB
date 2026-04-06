export type Member = {
  id: string;
  name: string;
  plan: string;
  status: string;
  payment: string;
  club: string;
  credits: number;
};

export type GymClass = {
  id: string;
  name: string;
  trainer: string;
  time: string;
  location: string;
  capacity: number;
  enrolled: number;
};

export type StaffLog = {
  id: number;
  name: string;
  role: string;
  type: string;
  time: string;
  location: string;
  status: string;
};

export const members: Member[] = [
  {
    id: "M001",
    name: "Rizky Pratama",
    plan: "10x Pass",
    status: "Active",
    payment: "Paid",
    club: "Puri Indah",
    credits: 4,
  },
  {
    id: "M002",
    name: "Sarah Wijaya",
    plan: "5x Pass",
    status: "Expiring Soon",
    payment: "Paid",
    club: "PIK Avenue",
    credits: 2,
  },
  {
    id: "M003",
    name: "Budi Santoso",
    plan: "Drop-in",
    status: "Expired",
    payment: "Unpaid",
    club: "Senopati",
    credits: 0,
  },
  {
    id: "M004",
    name: "Jessica Tan",
    plan: "Unlimited",
    status: "Active",
    payment: "Paid",
    club: "Puri Indah",
    credits: 99,
  },
  {
    id: "M005",
    name: "Michael Chen",
    plan: "10x Pass",
    status: "Pending",
    payment: "Pending",
    club: "PIK Avenue",
    credits: 0,
  },
  {
    id: "M006",
    name: "Kevin Sanjaya",
    plan: "5x Pass",
    status: "Expiring Soon",
    payment: "Paid",
    club: "Puri Indah",
    credits: 1,
  },
];

export const classes: GymClass[] = [
  {
    id: "C101",
    name: "Boxing Tekkers",
    trainer: "Coach Raka",
    time: "08:00",
    location: "Puri Indah",
    capacity: 20,
    enrolled: 12,
  },
  {
    id: "C102",
    name: "HIIT Cardio",
    trainer: "Coach Sarah",
    time: "10:00",
    location: "Puri Indah",
    capacity: 20,
    enrolled: 18,
  },
  {
    id: "C103",
    name: "Muay Thai",
    trainer: "Kru Dave",
    time: "17:00",
    location: "PIK Avenue",
    capacity: 15,
    enrolled: 5,
  },
  {
    id: "C104",
    name: "Strength & Cond",
    trainer: "Coach Budi",
    time: "19:00",
    location: "Senopati",
    capacity: 15,
    enrolled: 15,
  },
];

export const staffLogs: StaffLog[] = [
  {
    id: 1,
    name: "Andi Saputra",
    role: "Staff",
    type: "IN",
    time: "07:45",
    location: "Puri Indah",
    status: "On Time",
  },
  {
    id: 2,
    name: "Siti Aminah",
    role: "Cleaning",
    type: "IN",
    time: "07:55",
    location: "Puri Indah",
    status: "On Time",
  },
  {
    id: 3,
    name: "Bambang",
    role: "Trainer",
    type: "IN",
    time: "08:10",
    location: "PIK Avenue",
    status: "Late",
  },
];

export const recentTransactionAmount = "Rp 1.200.000";

export function getExpiringMembersCount(list: Member[]): number {
  return list.filter((m) => m.status === "Expiring Soon").length;
}
