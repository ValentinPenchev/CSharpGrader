
# C# Grader SaaS

Уеб система за автоматично проверяване на C# задачи.

Архитектура:
- GitHub Pages: frontend
- Render: Flask API + checker за .NET Console/Class Library
- Supabase: PostgreSQL + private Storage
- Optional Windows Checker: за Windows Forms

## Защо е разделено така?
GitHub Pages е само статичен frontend. Render е backend. Supabase пази заданията, резултатите и файловете. Private Storage е правилният избор за ученически проекти.

## Настройка

1. Supabase
   - създайте проект;
   - изпълнете `supabase/schema.sql`;
   - създайте private Storage bucket `submissions`;
   - вземете Project URL и service role key.

2. Render
   - създайте Web Service от `backend/`;
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app`
   - Environment:
     SUPABASE_URL
     SUPABASE_SERVICE_KEY
     SUPABASE_BUCKET=submissions
     ADMIN_KEY=<дълъг случаен ключ>

3. GitHub Pages
   - repository Settings → Pages → GitHub Actions;
   - workflow-ът `.github/workflows/pages.yml` публикува `frontend/`.
   - сменете `frontend/config.js` с Render URL.

## Важна препоръка
Не слагайте Supabase service role key във frontend. Той е само за Render.

## Връзка към ученик
Администраторът създава задача и получава:
`https://YOUR-GITHUB-PAGES-URL/?task=<public_token>`

Този линк може директно да се изпрати в Google Classroom.

## Следваща версия
За production:
- истинско admin login с Supabase Auth;
- rate limiting;
- CAPTCHA;
- ограничение по размер/разширение;
- signed upload URLs;
- Windows checker за WinForms;
- NUnit/xUnit hidden tests;
- CSV/Excel export;
- история на опитите;
- срок и автоматично заключване.
