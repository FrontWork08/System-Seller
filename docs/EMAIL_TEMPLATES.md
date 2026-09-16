# E-mails do System Seller

O SMTP de produção está conectado ao Brevo. Os modelos abaixo são os modelos recomendados para **Authentication > Emails > Templates** no projeto do System Seller.

> Mantenha `{{ .ConfirmationURL }}` exatamente como está. O Supabase gera o token e a URL segura.

## Confirm signup

**Assunto**

`Confirme seu e-mail — System Seller`

**Corpo**

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#152238">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">System Seller</div>
  <h2 style="margin:0 0 12px">Confirme seu e-mail</h2>
  <p style="line-height:1.6;color:#52657d">Falta apenas confirmar este endereço para liberar sua conta.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4ea4ff;color:#07111f;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Confirmar e-mail</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#71839a">Se você não criou uma conta no System Seller, pode ignorar esta mensagem.</p>
</div>
```

## Reset password

**Assunto**

`Redefina sua senha — System Seller`

**Corpo**

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#152238">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">System Seller</div>
  <h2 style="margin:0 0 12px">Redefina sua senha</h2>
  <p style="line-height:1.6;color:#52657d">Recebemos uma solicitação para alterar a senha da sua conta.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4ea4ff;color:#07111f;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Criar nova senha</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#71839a">Se você não solicitou a alteração, ignore esta mensagem e não compartilhe este link.</p>
</div>
```

## Change email address

**Assunto**

`Confirme seu novo e-mail — System Seller`

**Corpo**

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#152238">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">System Seller</div>
  <h2 style="margin:0 0 12px">Confirme seu novo e-mail</h2>
  <p style="line-height:1.6;color:#52657d">Confirme <strong>{{ .NewEmail }}</strong> como o novo endereço da sua conta.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4ea4ff;color:#07111f;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Confirmar novo e-mail</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#71839a">Se você não pediu essa alteração, não confirme o link.</p>
</div>
```

## Magic link

**Assunto**

`Seu acesso ao System Seller`

**Corpo**

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#152238">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">System Seller</div>
  <h2 style="margin:0 0 12px">Acesse sua conta</h2>
  <p style="line-height:1.6;color:#52657d">Use o botão abaixo para entrar com segurança.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4ea4ff;color:#07111f;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Entrar no System Seller</a>
  </p>
</div>
```

## Reauthentication

**Assunto**

`{{ .Token }} é seu código do System Seller`

**Corpo**

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#152238">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">System Seller</div>
  <h2 style="margin:0 0 12px">Código de verificação</h2>
  <p style="line-height:1.6;color:#52657d">Use este código para confirmar sua identidade:</p>
  <div style="font-size:32px;font-weight:900;letter-spacing:6px;margin:24px 0">{{ .Token }}</div>
  <p style="font-size:13px;color:#71839a">Não compartilhe este código.</p>
</div>
```

## Segurança do link

Para e-mails de autenticação, evite rastreamento de cliques que substitua o link original. O Supabase recomenda não reescrever links de autenticação por rastreadores de e-mail.
