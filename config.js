// ค่าเชื่อมต่อโปรเจกต์ Supabase (publishable key ใส่ในแอปได้ แต่ห้ามใส่ secret/service_role key)
// ใช้ได้เฉพาะ "anon/publishable key" ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด
window.CFG = { url: "https://uxwoxcyeqozhffxamyfi.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4d294Y3llcW96aGZmeGFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNDIxMDMsImV4cCI6MjEwODgxODEwM30.7yXVlOZIkXVTF1S2Zbu2BAaXS33nUP3Zle4L1wm5IIU" };
// ชื่อผู้ใช้ → อีเมลภายใน (Supabase ล็อกอินด้วยอีเมล) ใช้กับบัญชีทดสอบใน dev_only_seed_users.sql เท่านั้น
window.CFG.usernames = { "admin": "admin@port.test", "ผู้จัดการ": "manager@port.test" };
