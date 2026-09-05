import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo."),
    whatsapp: z.string().trim().min(8, "Informe um WhatsApp válido."),
    jobFunctionId: z.string().min(1, "Selecione uma função."),
    secondaryJobFunctionId: z.string().trim().optional(),
    weeklyDayOff: z.number().int().min(0).max(6).optional(),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z.string().min(1, "Informe usuário/WhatsApp."),
  password: z.string().min(1, "Informe a senha."),
});

export const createLeaveRequestSchema = z.object({
  type: z.enum(["DOMINGO_MES", "COMPENSATORIA", "EXTRA"]),
  date: z.string().date(), // "YYYY-MM-DD"
});

export const grantCreditSchema = z.object({
  employeeId: z.string().min(1),
  creditType: z.enum(["COMPENSATORIA", "EXTRA"]),
  amount: z.number().int().refine((n) => n !== 0, "Quantidade não pode ser zero."),
  originDate: z.string().date().optional(),
  reason: z.string().trim().min(1, "Informe o motivo."),
  note: z.string().trim().optional(),
});

export const correctCreditSchema = z.object({
  transactionId: z.string().min(1),
  correctedAmount: z.number().int(),
  reason: z.string().trim().min(1, "Informe o motivo da correção."),
});

export const blockDateSchema = z.object({
  date: z.string().date(),
  reason: z.string().trim().min(1, "Informe o motivo."),
});

export const holidaySchema = z.object({
  date: z.string().date(),
  name: z.string().trim().min(1),
  type: z.enum(["NACIONAL", "ESTADUAL", "MUNICIPAL"]),
  storeOpen: z.enum(["ABERTA", "FECHADA", "NAO_DEFINIDO"]),
});

export const jobFunctionSchema = z.object({
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1).default("Pronta Entrega"),
  dailyLeaveLimit: z.number().int().min(1).default(1),
  closedWeekday: z.number().int().min(0).max(6).nullable().optional(),
  followsStoreClosure: z.boolean().default(true),
});
