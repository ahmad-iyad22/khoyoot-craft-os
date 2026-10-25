ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS expires_on date;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.company_documents ALTER COLUMN url SET DEFAULT '';