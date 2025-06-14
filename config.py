import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL') or 'postgresql://statistic_ma7l_user:LEtrCDGbwKrAPg67xqlnWfwDUQsxM70g@dpg-d16oakndiees73dd8j6g-a.oregon-postgres.render.com/statistic_ma7l'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or 'admin123'
