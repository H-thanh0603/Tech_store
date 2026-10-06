-- Drop the 3-arg order_mark_paid_by_gateway overload superseded by the
-- 4-arg version (adds p_vnp_pay_date) in 202609230003. The stale overload
-- makes 3-arg calls ambiguous ("function is not unique") and shadows the
-- pay-date ledger. The 4-arg default (null) keeps old callers working.

drop function if exists order_mark_paid_by_gateway(text, text, bigint);
