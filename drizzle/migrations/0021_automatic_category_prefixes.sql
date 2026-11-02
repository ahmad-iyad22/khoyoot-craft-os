CREATE OR REPLACE FUNCTION public.category_auto_prefix() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE letters text; consonants text; candidate text; attempt integer:=0; used boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(771102);
 NEW.name:=btrim(NEW.name); NEW.name_ar:=NULLIF(btrim(NEW.name_ar),'');
 IF TG_OP='UPDATE' AND NEW.prefix_code IS NOT DISTINCT FROM OLD.prefix_code AND NEW.prefix_code IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.prefix_code IS NOT NULL THEN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'CATEGORY_PREFIX_OWNER'; END IF;
  IF EXISTS(SELECT 1 FROM public.products WHERE category_id=OLD.id OR sku LIKE OLD.prefix_code||'-%') THEN RAISE EXCEPTION 'CATEGORY_PREFIX_USED'; END IF;
 END IF;
 IF NULLIF(btrim(NEW.prefix_code),'') IS NOT NULL THEN
  candidate:=upper(btrim(NEW.prefix_code));
  IF candidate !~ '^[A-Z]{2,4}$' THEN RAISE EXCEPTION 'CATEGORY_PREFIX_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM public.sku_prefixes WHERE code=candidate) OR EXISTS(SELECT 1 FROM public.categories WHERE prefix_code=candidate AND id<>NEW.id) THEN RAISE EXCEPTION 'CATEGORY_PREFIX_TAKEN'; END IF;
 ELSE
  letters:=upper(regexp_replace(NEW.name,'[^a-zA-Z]','','g'));
  candidate:=rpad(left(letters,3),3,'X');
  IF EXISTS(SELECT 1 FROM public.sku_prefixes WHERE code=candidate) THEN
   consonants:=regexp_replace(substr(letters,2),'[AEIOU]','','g');
   candidate:=rpad(left(letters,1)||left(consonants,2),3,'X');
   IF EXISTS(SELECT 1 FROM public.sku_prefixes WHERE code=candidate) THEN
    LOOP
     attempt:=attempt+1;
     candidate:=rpad(left(letters,1)||left(consonants,1),2,'X')||attempt::text;
     EXIT WHEN NOT EXISTS(SELECT 1 FROM public.sku_prefixes WHERE code=candidate);
    END LOOP;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.sku_prefixes(code,label,label_ar,next_number) VALUES(candidate,NEW.name,NEW.name_ar,1);
 NEW.prefix_code:=candidate;
 RETURN NEW;
END $$;
CREATE TRIGGER category_auto_prefix BEFORE INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.category_auto_prefix();
UPDATE public.categories SET name=btrim(name),name_ar=NULLIF(btrim(name_ar),'') WHERE prefix_code IS NULL;
CREATE TRIGGER category_prefix_audit AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();