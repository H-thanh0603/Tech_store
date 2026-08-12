# Phase 1 Migration Reconciliation

## 1. Local Migration State vs Cloud State

| Feature Area | Local Repository | Cloud Production | SQL Action Required |
|---|---|---|---|
| Core Catalog | ✅ 202607230001 | ✅ Applied | None |
| Catalog List View | ✅ 202607230002 | ✅ Applied | None |
| Commerce Schema | ✅ 202607240003 | ✅ Applied | None |
| Cart RPCs | ✅ 202607240004 | ✅ Applied | None |
| **Missing Later Features:** |
| Order & Tracking | ✅ 202607240005 - 202607240008 | ❌ Missing | Push via CI/Staging |
| Admin Operations | ✅ 202607250009 - 202607250013 | ❌ Missing | Push via CI/Staging |
| Reviews & Content | ✅ 202607250014 - 202607260019 | ❌ Missing | Push via CI/Staging |
| Security/Fixes | ✅ 20260726141123 - 202607280004 | ❌ Missing | Push via CI/Staging |

## 2. Fresh Bootstrap Proof
- Current status: Running `supabase start` to bootstrap all 26 local migrations to a fresh DB.
- Target: Verify 31 public tables and all RPCs.

## 3. Plan for Production Cloud
Since the Cloud DB only has 4 migrations and is missing the rest, we will apply the remaining migrations to the Staging DB first. Once verified, these will be applied to Production. We will NOT rewrite existing applied migrations.
