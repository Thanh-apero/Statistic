# Web Thống Kê Chi Tiêu Phòng Trọ

Một ứng dụng web đẹp để quản lý và thống kê chi tiêu của các thành viên trong phòng trọ.

## Tính năng

- ✨ Giao diện đẹp, hiện đại với gradient background
- 📊 Thống kê tổng quan (tổng chi tiêu, số giao dịch, trung bình)
- ➕ Thêm chi tiêu mới với tên, số tiền, và mục đích
- ✏️ Chỉnh sửa thông tin chi tiêu
- 🗑️ Xóa chi tiêu
- 📝 Lưu và hiển thị lịch sử chỉnh sửa đầy đủ
- 📱 Responsive design - tương thích mobile
- 🔔 Thông báo toast khi thực hiện các thao tác

## Cài đặt và chạy

### 1. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 2. Chạy ứng dụng

```bash
python app.py
```

### 3. Truy cập

Mở trình duyệt và truy cập: `http://localhost:5000`

## Deploy lên server

### Deploy với Gunicorn (Production)

```bash
# Cài đặt Gunicorn
pip install gunicorn

# Chạy với Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Deploy với Docker

```bash
# Build Docker image
docker build -t expense-tracker .

# Chạy container
docker run -p 5000:5000 expense-tracker
```

### Deploy lên Heroku

1. Tạo file `Procfile`:

```
web: gunicorn app:app
```

2. Deploy:

```bash
heroku create your-app-name
git push heroku main
```

## Cấu trúc project

```
.
├── app.py              # Flask backend
├── requirements.txt    # Dependencies
├── templates/
│   └── index.html     # Frontend template
├── static/
│   ├── css/
│   │   └── style.css  # Styles
│   └── js/
│       └── app.js     # JavaScript logic
├── expenses.json      # Dữ liệu chi tiêu (auto-generated)
├── history.json       # Lịch sử chỉnh sửa (auto-generated)
└── README.md
```

## API Endpoints

- `GET /` - Trang chủ
- `GET /api/expenses` - Lấy danh sách chi tiêu
- `POST /api/expenses` - Thêm chi tiêu mới
- `PUT /api/expenses/<id>` - Cập nhật chi tiêu
- `DELETE /api/expenses/<id>` - Xóa chi tiêu
- `GET /api/history` - Lấy lịch sử chỉnh sửa
- `GET /api/stats` - Lấy thống kê

## Công nghệ sử dụng

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Icons**: Font Awesome 6
- **Fonts**: Google Fonts (Inter)
- **Storage**: JSON files (có thể chuyển sang database dễ dàng)

## Tùy chỉnh

Để thay đổi màu sắc, chỉnh sửa file `static/css/style.css`. Gradient chính được định nghĩa ở:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```