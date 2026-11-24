-- Unlock Menu · arquivos
-- uploads: privado. O navegador só envia com URL assinada emitida pelo servidor
--          (depois de conferir papel e plano). Limite de tamanho e tipo no próprio bucket.
-- media:   público para leitura (fotos/vídeos do cardápio). Só o servidor grava,
--          depois de validar e re-encodar o arquivo (imagem → webp, vídeo → mp4 720p).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('media', 'media', true, 10485760,
    array['image/webp', 'image/jpeg', 'video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Nenhuma policy de escrita para anon/authenticated em storage.objects:
-- toda gravação passa pelo servidor (service_role).
