CREATE OR REPLACE FUNCTION public.guard_profile_billing()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if current_user in ('authenticated','anon') and (
       new.plan is distinct from old.plan
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_current_period_end is distinct from old.subscription_current_period_end
    or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    or new.payment_method_brand is distinct from old.payment_method_brand
    or new.payment_method_last4 is distinct from old.payment_method_last4
  ) then
    raise exception 'profiles billing columns are managed by Stripe and cannot be changed directly';
  end if;
  return new;
end; $function$;

REVOKE ALL ON FUNCTION "public"."guard_profile_billing"() FROM PUBLIC, "anon", "authenticated", "service_role";
