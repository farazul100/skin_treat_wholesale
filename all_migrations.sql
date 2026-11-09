
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- User roles enum and table FIRST
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- has_role function BEFORE any policies that use it
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Only admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),
  sku TEXT,
  stock INT DEFAULT 0,
  category_id UUID REFERENCES public.categories(id),
  images TEXT[] DEFAULT '{}',
  badge TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Only admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_charge NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  partial_payment NUMERIC(10,2) DEFAULT 0,
  due_amount NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Site settings table
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can manage settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_settings (key, value) VALUES
  ('payment_gateway', '{"enabled": false, "provider": "sslcommerz"}'),
  ('delivery_charge', '{"inside_dhaka": 60, "outside_dhaka": 120}'),
  ('partial_payment_percent', '{"percent": 10}');

-- Reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved reviews are viewable by everyone" ON public.reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews" ON public.reviews FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'NS-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

CREATE TABLE public.incomplete_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  shipping_address TEXT,
  city TEXT,
  area TEXT,
  cart_items JSONB DEFAULT '[]',
  cart_total NUMERIC(10,2) DEFAULT 0,
  is_converted BOOLEAN DEFAULT false,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incomplete_orders ENABLE ROW LEVEL SECURITY;

-- Anyone can insert/update (guest checkout support)
CREATE POLICY "Anyone can create incomplete orders" ON public.incomplete_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own incomplete order by session" ON public.incomplete_orders FOR UPDATE USING (true);

-- Only admins can view all
CREATE POLICY "Admins can manage incomplete orders" ON public.incomplete_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Index for session lookup
CREATE INDEX idx_incomplete_orders_session ON public.incomplete_orders(session_id);
CREATE INDEX idx_incomplete_orders_converted ON public.incomplete_orders(is_converted, last_activity DESC);

-- Updated at trigger
CREATE TRIGGER update_incomplete_orders_updated_at BEFORE UPDATE ON public.incomplete_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomplete_orders;

-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  has_unread BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'customer',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_conversations_session ON public.chat_conversations(session_id);
CREATE INDEX idx_chat_conversations_unread ON public.chat_conversations(has_unread) WHERE has_unread = true;
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversation policies
CREATE POLICY "Anyone can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view own conversation by session" ON public.chat_conversations FOR SELECT USING (true);
CREATE POLICY "Anyone can update own conversation" ON public.chat_conversations FOR UPDATE USING (true);
CREATE POLICY "Admins can manage all conversations" ON public.chat_conversations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Message policies
CREATE POLICY "Anyone can send messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view messages of their conversation" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Admins can manage all messages" ON public.chat_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Update trigger
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.orders ADD COLUMN is_trashed BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_orders_trashed ON public.orders(is_trashed) WHERE is_trashed = true;

ALTER TABLE public.products ADD COLUMN meta_title TEXT;
ALTER TABLE public.products ADD COLUMN meta_description TEXT;
ALTER TABLE public.products ADD COLUMN focus_keyword TEXT;

ALTER TABLE public.products ADD COLUMN video_url TEXT;
ALTER TABLE public.products ADD COLUMN video_thumbnail TEXT;

CREATE TABLE public.code_snippets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  code text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'javascript',
  placement text NOT NULL DEFAULT 'body_end',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.code_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active snippets"
ON public.code_snippets FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage snippets"
ON public.code_snippets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_code_snippets_updated_at
BEFORE UPDATE ON public.code_snippets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  title TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero slides viewable by everyone"
ON public.hero_slides FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage hero slides"
ON public.hero_slides FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_hero_slides_updated_at
BEFORE UPDATE ON public.hero_slides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Add image column to reviews table
ALTER TABLE public.reviews ADD COLUMN image text;

-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public) VALUES ('review-images', 'review-images', true);

-- Anyone can view review images
CREATE POLICY "Review images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

-- Only admins can upload review images
CREATE POLICY "Admins can upload review images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete review images
CREATE POLICY "Admins can delete review images"
ON storage.objects FOR DELETE
USING (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update review images
CREATE POLICY "Admins can update review images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.shefa_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shefa_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos are viewable by everyone"
ON public.shefa_videos FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage videos"
ON public.shefa_videos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_shefa_videos_active_sort ON public.shefa_videos(is_active, sort_order);

-- =========================================================
-- 1. SITE_SETTINGS: lock down to admin-only, add safe public RPC
-- =========================================================

DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.site_settings;

-- Admin ALL policy already exists ("Only admins can manage settings"), keep it.

-- Helper: list of keys that are safe to expose publicly (sanitized values where needed)
CREATE OR REPLACE FUNCTION public.get_public_setting(_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw jsonb;
  result jsonb;
BEGIN
  SELECT value INTO raw FROM public.site_settings WHERE key = _key;
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sanitize sensitive keys: only return non-secret fields
  IF _key = 'facebook_pixel' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'pixel_id', COALESCE(raw->'pixel_id', '""'::jsonb)
    );
  ELSIF _key = 'cloudinary' THEN
    -- cloud_name and unsigned upload_preset are safe (used client-side for uploads)
    result := jsonb_build_object(
      'cloud_name', COALESCE(raw->'cloud_name', '""'::jsonb),
      'upload_preset', COALESCE(raw->'upload_preset', '""'::jsonb)
    );
  ELSIF _key = 'payment_gateway' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'provider', COALESCE(raw->'provider', '""'::jsonb)
    );
  ELSIF _key IN (
    'site_logo','site_favicon','topbar_texts','footer_content','promo_banners',
    'social_media','whatsapp_number','delivery_charge','partial_payment_percent',
    'money_back_banner','hero_settings','key_points','why_us','customer_reviews_settings',
    'page_about','page_contact','page_privacy','page_terms','page_refund','page_shipping',
    'page_faq'
  ) THEN
    result := raw;
  ELSE
    -- Unknown / non-public key (e.g. order_webhook, steadfast): return null
    result := NULL;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_setting(text) TO anon, authenticated;

-- =========================================================
-- 2. CHAT: restrict by session_id sent via request header `x-session-id`
-- =========================================================

DROP POLICY IF EXISTS "Anyone can view own conversation by session" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can update own conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can view messages of their conversation" ON public.chat_messages;

CREATE POLICY "Session owner can view own conversation"
ON public.chat_conversations FOR SELECT
USING (
  session_id = COALESCE(current_setting('request.headers', true)::jsonb->>'x-session-id', '')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Session owner can update own conversation"
ON public.chat_conversations FOR UPDATE
USING (
  session_id = COALESCE(current_setting('request.headers', true)::jsonb->>'x-session-id', '')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Session owner can view own messages"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (
        c.session_id = COALESCE(current_setting('request.headers', true)::jsonb->>'x-session-id', '')
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

-- =========================================================
-- 3. STORAGE: prevent public listing of review-images bucket
--    (objects remain accessible by direct URL since bucket is public)
-- =========================================================

-- Drop any existing broad SELECT policies for review-images
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname ILIKE '%review-images%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- Only admins can list/manage storage objects in this bucket via the API.
-- (Direct CDN URLs still work because the bucket is marked public.)
CREATE POLICY "Admins can manage review-images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bestseller boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_is_bestseller ON public.products(is_bestseller) WHERE is_bestseller = true;
CREATE OR REPLACE FUNCTION public.get_public_setting(_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  raw jsonb;
  result jsonb;
BEGIN
  SELECT value INTO raw FROM public.site_settings WHERE key = _key;
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF _key = 'facebook_pixel' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'pixel_id', COALESCE(raw->'pixel_id', '""'::jsonb)
    );
  ELSIF _key = 'cloudinary' THEN
    result := jsonb_build_object(
      'cloud_name', COALESCE(raw->'cloud_name', '""'::jsonb),
      'upload_preset', COALESCE(raw->'upload_preset', '""'::jsonb)
    );
  ELSIF _key = 'payment_gateway' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'provider', COALESCE(raw->'provider', '""'::jsonb)
    );
  ELSIF _key IN (
    'site_logo','site_favicon','topbar_texts','footer_content','promo_banners',
    'social_media','whatsapp_number','delivery_charge','partial_payment_percent',
    'money_back_banner','hero_settings','key_points','why_us','customer_reviews_settings',
    'page_about','page_contact','page_privacy','page_terms','page_refund','page_shipping',
    'page_faq','categories_enabled'
  ) THEN
    result := raw;
  ELSE
    result := NULL;
  END IF;

  RETURN result;
END;
$function$;

-- ==========================================
-- Admin Users & Sessions Table (MySQL / phpMyAdmin)
-- ==========================================
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `full_name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `token` VARCHAR(128) PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO public.site_settings (key, value)
VALUES ('categories_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON public.products(sort_order);
CREATE OR REPLACE FUNCTION public.get_public_setting(_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  raw jsonb;
  result jsonb;
BEGIN
  SELECT value INTO raw FROM public.site_settings WHERE key = _key;
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF _key = 'facebook_pixel' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'pixel_id', COALESCE(raw->'pixel_id', '""'::jsonb),
      'test_event_code', COALESCE(raw->'test_event_code', '""'::jsonb)
    );
  ELSIF _key = 'cloudinary' THEN
    result := jsonb_build_object(
      'cloud_name', COALESCE(raw->'cloud_name', '""'::jsonb),
      'upload_preset', COALESCE(raw->'upload_preset', '""'::jsonb)
    );
  ELSIF _key = 'payment_gateway' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'provider', COALESCE(raw->'provider', '""'::jsonb)
    );
  ELSIF _key IN (
    'site_logo','site_favicon','topbar_texts','footer_content','promo_banners',
    'social_media','whatsapp_number','delivery_charge','partial_payment_percent',
    'money_back_banner','hero_settings','key_points','why_us','customer_reviews_settings',
    'page_about','page_contact','page_privacy','page_terms','page_refund','page_shipping',
    'page_faq','categories_enabled'
  ) THEN
    result := raw;
  ELSE
    result := NULL;
  END IF;

  RETURN result;
END;
$function$;

-- ==========================================
-- Admin Users & Sessions Table (MySQL / phpMyAdmin)
-- ==========================================
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `full_name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `token` VARCHAR(128) PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.get_public_setting(_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  raw jsonb;
  result jsonb;
BEGIN
  SELECT value INTO raw FROM public.site_settings WHERE key = _key;
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF _key = 'facebook_pixel' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'pixel_id', COALESCE(raw->'pixel_id', '""'::jsonb),
      'test_event_code', COALESCE(raw->'test_event_code', '""'::jsonb)
    );
  ELSIF _key = 'cloudinary' THEN
    result := jsonb_build_object(
      'cloud_name', COALESCE(raw->'cloud_name', '""'::jsonb),
      'upload_preset', COALESCE(raw->'upload_preset', '""'::jsonb)
    );
  ELSIF _key = 'payment_gateway' THEN
    result := jsonb_build_object(
      'enabled', COALESCE(raw->'enabled', 'false'::jsonb),
      'provider', COALESCE(raw->'provider', '""'::jsonb)
    );
  ELSIF _key IN (
    'site_logo','site_favicon','site_title','theme_color','topbar_texts','footer_content','promo_banners',
    'social_media','whatsapp_number','delivery_charge','partial_payment_percent',
    'money_back_banner','hero_settings','key_points','why_us','customer_reviews_settings',
    'page_about','page_contact','page_privacy','page_terms','page_refund','page_shipping',
    'page_faq','categories_enabled'
  ) THEN
    result := raw;
  ELSE
    result := NULL;
  END IF;

  RETURN result;
END;
$function$;

-- ==========================================
-- Admin Users & Sessions Table (MySQL / phpMyAdmin)
-- ==========================================
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `full_name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `token` VARCHAR(128) PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

