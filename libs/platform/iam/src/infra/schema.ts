import { pgEnum, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '@erp/platform-tenancy';

const platform = pgSchema('platform');

export const userStatus = pgEnum('user_status', ['ACTIVE', 'DELETED']);
export const membershipStatus = pgEnum('membership_status', ['ACTIVE', 'REVOKED']);

/** Espelho local de um User do Clerk. Global: um usuário atende vários tenants. */
export const users = platform.table('users', {
  id: uuid('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  status: userStatus('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Espelho local de uma OrganizationMembership do Clerk. Tem tenant_id, logo tem RLS. */
export const memberships = platform.table(
  'memberships',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    clerkMembershipId: text('clerk_membership_id').notNull().unique(),
    status: membershipStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('memberships_tenant_user_unique').on(table.tenantId, table.userId)],
);
