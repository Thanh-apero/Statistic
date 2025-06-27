class ExpenseManager {
    constructor() {
        this.expenses = [];
        this.editingId = null;
        this.isLocked = false;
        this.currentAction = null;
        this.memberSuggestions = new Set(); // Lưu danh sách tên thành viên
        this.init();
    }

    init() {
        this.loadExpenses();
        this.loadStats();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Thêm event listener cho input số tiền để hiển thị preview
        const amountInput = document.getElementById('amount');
        amountInput.addEventListener('input', (e) => {
            this.updateAmountPreview(e.target.value);
        });

        // Thêm event listener cho input tên để kích hoạt autocomplete
        const nameInput = document.getElementById('name');
        nameInput.addEventListener('input', (e) => {
            this.showSuggestions(e.target.value);
        });

        // Xử lý phím mũi tên cho navigation
        nameInput.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });

        // Ẩn suggestions khi click ra ngoài
        nameInput.addEventListener('blur', (e) => {
            // Delay để cho phép click vào suggestions
            setTimeout(() => {
                this.hideSuggestions();
            }, 200);
        });

        // Hiển thị suggestions khi focus vào input
        nameInput.addEventListener('focus', (e) => {
            // Hiển thị tất cả gợi ý khi focus, hoặc filter theo giá trị hiện tại
            this.showSuggestions(e.target.value || '');
        });

        window.onclick = (event) => {
            const historyModal = document.getElementById('historyModal');
            const personModal = document.getElementById('personModal');
            const passwordModal = document.getElementById('passwordModal');
            const archiveModal = document.getElementById('archiveModal');
            const archiveListModal = document.getElementById('archiveListModal');
            
            if (event.target === historyModal) {
                historyModal.style.display = 'none';
            }
            if (event.target === personModal) {
                personModal.style.display = 'none';
            }
            if (event.target === passwordModal) {
                passwordModal.style.display = 'none';
            }
            if (event.target === archiveModal) {
                archiveModal.style.display = 'none';
            }
            if (event.target === archiveListModal) {
                archiveListModal.style.display = 'none';
            }
        };
    }

    async loadExpenses() {
        try {
            const response = await fetch('/api/expenses');
            this.expenses = await response.json();
            // Cập nhật danh sách gợi ý tên thành viên
            this.expenses.forEach(expense => {
                this.memberSuggestions.add(expense.name);
            });
            this.renderExpenses();
            this.setupAutocomplete();
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            this.updateStats(stats);
            this.loadPeopleStats();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadPeopleStats() {
        try {
            const response = await fetch('/api/stats/people');
            const peopleStats = await response.json();
            this.renderPeopleStats(peopleStats);
        } catch (error) {
            console.error('Error loading people stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('totalAmount').textContent = this.formatCurrency(stats.total);
        document.getElementById('totalCount').textContent = stats.count;
        document.getElementById('averageAmount').textContent = this.formatCurrency(stats.average);
    }

    renderPeopleStats(peopleStats) {
        const grid = document.getElementById('peopleStatsGrid');
        grid.innerHTML = '';

        if (peopleStats.length === 0) {
            grid.innerHTML = '<div class="loading">Chưa có dữ liệu thống kê</div>';
            return;
        }

        // Tính trung bình cho việc cân bằng
        const totalAmount = peopleStats.reduce((sum, person) => sum + person.total, 0);
        const averagePerPerson = totalAmount / peopleStats.length;

        peopleStats.forEach(person => {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.onclick = () => this.showPersonDetail(person.name);
            
            // Tính số tiền cần nộp/nhận (trung bình - đã chi)
            const balance = person.total - averagePerPerson;
            
            card.innerHTML = `
                <div class="person-card-content">
                    <span class="person-name">${person.name}</span>
                    <span class="person-transactions">${person.count} giao dịch</span>
                    <span class="person-total">${this.formatCurrency(person.total)}</span>
                    <span class="person-balance ${balance >= 0 ? 'positive' : 'negative'}">
                        ${balance >= 0 ? '+' : ''}${this.formatCurrency(Math.abs(balance))}
                    </span>
                    <span class="person-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                </div>
            `;
            
            grid.appendChild(card);
        });
    }

    renderExpenses() {
        const tbody = document.getElementById('expenseTableBody');
        tbody.innerHTML = '';

        if (this.expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Chưa có chi tiêu nào</td></tr>';
            return;
        }

        this.expenses.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${expense.name}</td>
                <td class="amount">${this.formatCurrency(expense.amount)}</td>
                <td>${expense.purpose}</td>
                <td>${this.formatDate(expense.date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="expenseManager.editExpense(${expense.id})">
                            <i class="fas fa-edit"></i> Sửa
                        </button>
                        <button class="btn btn-danger" onclick="expenseManager.deleteExpense(${expense.id})">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async handleFormSubmit() {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }
        
        const formData = new FormData(document.getElementById('expenseForm'));
        
        // Chuẩn hóa tên: trim space và capitalize từng từ
        let rawName = formData.get('name').trim();
        const normalizedName = this.normalizeName(rawName);
        
        // Chuyển đổi số tiền: nhập 1 = 1000 VNĐ
        let rawAmount = parseFloat(formData.get('amount'));
        const actualAmount = rawAmount * 1000;
        
        const data = {
            name: normalizedName,
            amount: actualAmount,
            purpose: formData.get('purpose').trim()
        };

        if (!data.name || !data.amount || !data.purpose) {
            this.showNotification('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }

        try {
            const url = this.editingId ? `/api/expenses/${this.editingId}` : '/api/expenses';
            const method = this.editingId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // Thêm tên mới vào danh sách gợi ý
                this.memberSuggestions.add(normalizedName);
                
                this.resetForm();
                this.loadExpenses();
                this.loadStats();
                
                const message = this.editingId ? 'Cập nhật thành công!' : 'Thêm chi tiêu thành công!';
                this.showNotification(message, 'success');
            } else {
                this.showNotification('Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    editExpense(id) {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }
        
        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            document.getElementById('name').value = expense.name;
            // Hiển thị số tiền đã chia cho 1000 (số đơn giản)
            document.getElementById('amount').value = expense.amount / 1000;
            document.getElementById('purpose').value = expense.purpose;
            
            this.editingId = id;
            document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Cập nhật';
            
            document.querySelector('.form-section h2').scrollIntoView({ behavior: 'smooth' });
        }
    }

    async deleteExpense(id) {
        if (this.isLocked) {
            this.showNotification('Chức năng đã bị khóa', 'error');
            return;
        }
        
        if (!confirm('Bạn có chắc chắn muốn xóa chi tiêu này?')) {
            return;
        }

        try {
            const response = await fetch(`/api/expenses/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadExpenses();
                this.loadStats();
                this.showNotification('Xóa thành công!', 'success');
            } else {
                this.showNotification('Có lỗi xảy ra khi xóa', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    resetForm() {
        document.getElementById('expenseForm').reset();
        this.editingId = null;
        document.getElementById('submitBtn').innerHTML = '<i class="fas fa-plus"></i> Thêm chi tiêu';
        this.hideSuggestions();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    // Thêm method để cập nhật preview số tiền
    updateAmountPreview(value) {
        const amountInput = document.getElementById('amount');
        const formHint = amountInput.parentElement.querySelector('.form-hint');
        
        if (value && !isNaN(value) && parseFloat(value) > 0) {
            const actualAmount = parseFloat(value) * 1000;
            formHint.textContent = `= ${this.formatCurrency(actualAmount)}`;
            formHint.style.color = '#48bb78';
            formHint.style.fontWeight = '600';
        } else {
            formHint.textContent = 'Nhập số đơn giản: 1 = 1,000 VNĐ';
            formHint.style.color = '#718096';
            formHint.style.fontWeight = 'normal';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Thêm method để chuẩn hóa tên
    normalizeName(name) {
        if (!name) return '';
        
        return name
            .trim()
            .toLowerCase()
            .split(' ')
            .filter(word => word.length > 0) // Loại bỏ khoảng trắng thừa
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    setupAutocomplete() {
        const nameInput = document.getElementById('name');
        this.suggestionBox = document.createElement('div');
        this.suggestionBox.className = 'suggestion-box';
        this.selectedIndex = -1; // Index của suggestion được chọn
        nameInput.parentNode.appendChild(this.suggestionBox);
    }

    handleKeyNavigation(e) {
        if (!this.suggestionBox || this.suggestionBox.style.display === 'none') {
            return;
        }

        const suggestions = this.suggestionBox.querySelectorAll('.suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, suggestions.length - 1);
                this.highlightSuggestion(suggestions);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.highlightSuggestion(suggestions);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && suggestions[this.selectedIndex]) {
                    suggestions[this.selectedIndex].click();
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    highlightSuggestion(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    showSuggestions(input) {
        let filtered;
        
        if (!input || input.trim() === '') {
            // Hiển thị tất cả gợi ý khi không có input
            filtered = Array.from(this.memberSuggestions);
        } else {
            // Filter theo input
            filtered = Array.from(this.memberSuggestions).filter(name => 
                name.toLowerCase().includes(input.toLowerCase())
            );
        }

        if (filtered.length === 0) {
            this.hideSuggestions();
            return;
        }

        // Sắp xếp theo độ phổ biến (số lần xuất hiện)
        const sortedFiltered = filtered.sort((a, b) => {
            const countA = this.expenses.filter(exp => exp.name === a).length;
            const countB = this.expenses.filter(exp => exp.name === b).length;
            return countB - countA;
        });

        this.suggestionBox.innerHTML = sortedFiltered.map(name => {
            const count = this.expenses.filter(exp => exp.name === name).length;
            const total = this.expenses.filter(exp => exp.name === name)
                .reduce((sum, exp) => sum + exp.amount, 0);
            return `<div class="suggestion-item" onclick="expenseManager.selectSuggestion('${name}')">
                <div class="suggestion-info">
                    <div class="suggestion-name">${name}</div>
                    <div class="suggestion-details">
                        <span class="suggestion-count">${count} giao dịch</span>
                        <span class="suggestion-total">${this.formatCurrency(total)}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
        
        this.selectedIndex = -1; // Reset selection
        this.suggestionBox.style.display = 'block';
    }

    hideSuggestions() {
        if (this.suggestionBox) {
            this.suggestionBox.style.display = 'none';
            this.selectedIndex = -1; // Reset selection
        }
    }

    selectSuggestion(name) {
        document.getElementById('name').value = name;
        this.hideSuggestions();
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#48bb78' : '#f56565'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    async showPersonDetail(name) {
        try {
            const response = await fetch(`/api/people/${encodeURIComponent(name)}/expenses`);
            const personData = await response.json();
            
            if (response.ok) {
                this.renderPersonDetail(personData);
                document.getElementById('personModal').style.display = 'block';
            } else {
                this.showNotification('Không thể tải chi tiết người này', 'error');
            }
        } catch (error) {
            console.error('Error loading person detail:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    renderPersonDetail(personData) {
        document.getElementById('personName').textContent = personData.name;
        
        const summary = document.getElementById('personSummary');
        summary.innerHTML = `
            <h4>Tổng quan chi tiêu</h4>
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="summary-stat-value">${this.formatCurrency(personData.total)}</div>
                    <div class="summary-stat-label">Tổng chi tiêu</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">${personData.count}</div>
                    <div class="summary-stat-label">Số giao dịch</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">${this.formatCurrency(personData.total / personData.count)}</div>
                    <div class="summary-stat-label">Trung bình</div>
                </div>
            </div>
        `;
        
        const expenses = document.getElementById('personExpenses');
        expenses.innerHTML = '<h4>Chi tiết các khoản chi tiêu</h4>';
        
        personData.expenses.forEach(expense => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <div class="expense-item-header">
                    <div class="expense-amount">${this.formatCurrency(expense.amount)}</div>
                    <div class="expense-date">${this.formatDate(expense.date)}</div>
                </div>
                <div class="expense-purpose">${expense.purpose}</div>
            `;
            expenses.appendChild(item);
        });
    }

    updateLockUI() {
        const body = document.body;
        const lockIcon = document.getElementById('lockIcon');
        const lockText = document.getElementById('lockText');
        
        if (this.isLocked) {
            body.classList.add('locked');
            lockIcon.className = 'fas fa-lock';
            lockText.textContent = 'Đã khóa';
        } else {
            body.classList.remove('locked');
            lockIcon.className = 'fas fa-lock-open';
            lockText.textContent = 'Mở khóa';
        }
    }

    async archiveData(password) {
        try {
            const response = await fetch('/api/archive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification(`Đã lưu trữ ${result.archived_items} mục và bắt đầu thống kê mới!`, 'success');
                this.loadExpenses();
                this.loadStats();
                this.loadPeopleStats();
            } else {
                this.showNotification(result.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Error archiving data:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    async toggleLockStatus(password) {
        try {
            const response = await fetch('/api/lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.isLocked = !this.isLocked;
                this.updateLockUI();
                const status = this.isLocked ? 'khóa' : 'mở khóa';
                this.showNotification(`Đã ${status} chức năng chỉnh sửa`, 'success');
            } else {
                this.showNotification(result.error || 'Mật khẩu không đúng', 'error');
            }
        } catch (error) {
            console.error('Error toggling lock:', error);
            this.showNotification('Có lỗi xảy ra', 'error');
        }
    }

    async loadArchiveList() {
        try {
            const response = await fetch('/api/archive/stats');
            const archives = await response.json();
            this.renderArchiveList(archives);
        } catch (error) {
            console.error('Error loading archive list:', error);
        }
    }

    renderArchiveList(archives) {
        const list = document.getElementById('archiveList');
        list.innerHTML = '';

        if (archives.length === 0) {
            list.innerHTML = '<div class="loading">Chưa có dữ liệu lưu trữ</div>';
            return;
        }

        archives.reverse().forEach((archive, index) => {
            const item = document.createElement('div');
            item.className = 'archive-item clickable';
            item.onclick = () => this.showArchiveDetail(archive, archives.length - index);
            
            const total = archive.data.reduce((sum, exp) => sum + exp.amount, 0);
            const peopleCount = [...new Set(archive.data.map(exp => exp.name))].length;
            
            item.innerHTML = `
                <div class="archive-header">
                    <div class="archive-title">
                        <i class="fas fa-archive"></i>
                        <span>Đợt ${archives.length - index}</span>
                    </div>
                    <div class="archive-meta">
                        <span class="archive-date">${this.formatDate(archive.timestamp)}</span>
                        <div class="archive-arrow">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>
                <div class="archive-stats">
                    <div class="archive-stat">
                        <i class="fas fa-receipt"></i>
                        <span>${archive.data.length} giao dịch</span>
                    </div>
                    <div class="archive-stat">
                        <i class="fas fa-users"></i>
                        <span>${peopleCount} người</span>
                    </div>
                    <div class="archive-stat total">
                        <i class="fas fa-wallet"></i>
                        <span>${this.formatCurrency(total)}</span>
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
    }

    showArchiveDetail(archive, periodNumber) {
        // Create archive detail modal content
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'archiveDetailModal';
        
        const total = archive.data.reduce((sum, exp) => sum + exp.amount, 0);
        const peopleStats = {};
        
        // Calculate people stats for this archive
        archive.data.forEach(exp => {
            if (!peopleStats[exp.name]) {
                peopleStats[exp.name] = { total: 0, count: 0 };
            }
            peopleStats[exp.name].total += exp.amount;
            peopleStats[exp.name].count += 1;
        });
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-archive"></i> Chi Tiết Đợt ${periodNumber}</h3>
                    <span class="close" onclick="closeArchiveDetailModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="archive-detail-summary">
                        <h4>Tổng quan</h4>
                        <div class="summary-stats">
                            <div class="summary-stat">
                                <div class="summary-stat-value">${this.formatCurrency(total)}</div>
                                <div class="summary-stat-label">Tổng chi tiêu</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${archive.data.length}</div>
                                <div class="summary-stat-label">Số giao dịch</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${Object.keys(peopleStats).length}</div>
                                <div class="summary-stat-label">Số người</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="archive-people-stats">
                        <h4>Thống kê theo người</h4>
                        <div class="people-stats-list">
                            ${Object.entries(peopleStats)
                                .sort(([,a], [,b]) => b.total - a.total)
                                .map(([name, stats]) => `
                                    <div class="person-stat-item">
                                        <div class="person-stat-name">${name}</div>
                                        <div class="person-stat-details">
                                            <span class="person-stat-amount">${this.formatCurrency(stats.total)}</span>
                                            <span class="person-stat-count">(${stats.count} giao dịch)</span>
                                        </div>
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                    
                    <div class="archive-expenses">
                        <h4>Chi tiết giao dịch</h4>
                        <div class="expenses-list">
                            ${archive.data.map(exp => `
                                <div class="expense-item">
                                    <div class="expense-item-header">
                                        <div class="expense-name">${exp.name}</div>
                                        <div class="expense-amount">${this.formatCurrency(exp.amount)}</div>
                                    </div>
                                    <div class="expense-purpose">${exp.purpose}</div>
                                    <div class="expense-date">${this.formatDate(exp.date)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/history');
            const history = await response.json();
            this.renderHistory(history);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    renderHistory(history) {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<div class="loading">Chưa có lịch sử chỉnh sửa</div>';
            return;
        }

        history.reverse().forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            let actionText = '';
            let dataText = '';
            
            // Parse JSON data
            let parsedData;
            try {
                parsedData = JSON.parse(item.data);
            } catch (e) {
                console.error('Error parsing history data:', e);
                parsedData = item.data;
            }
            
            switch (item.action) {
                case 'ADD':
                    actionText = '➕ Thêm chi tiêu mới';
                    dataText = `${parsedData.name} - ${this.formatCurrency(parsedData.amount)} - ${parsedData.purpose}`;
                    break;
                case 'UPDATE':
                    actionText = '✏️ Cập nhật chi tiêu';
                    dataText = `${parsedData.new.name} - ${this.formatCurrency(parsedData.new.amount)} - ${parsedData.new.purpose}`;
                    break;
                case 'DELETE':
                    actionText = '🗑️ Xóa chi tiêu';
                    dataText = `${parsedData.name} - ${this.formatCurrency(parsedData.amount)} - ${parsedData.purpose}`;
                    break;
                case 'ARCHIVE':
                    actionText = '📦 Lưu trữ dữ liệu';
                    dataText = `Đã lưu trữ ${parsedData.count} mục chi tiêu`;
                    break;
                default:
                    actionText = `📝 ${item.action}`;
                    dataText = JSON.stringify(parsedData);
            }

            historyItem.innerHTML = `
                <div class="history-action">${actionText}</div>
                <div class="history-time">${this.formatDate(item.timestamp)}</div>
                <div class="history-data">${dataText}</div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }
}

function toggleHistory() {
    const modal = document.getElementById('historyModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        expenseManager.loadHistory();
    }
}

function closePersonModal() {
    document.getElementById('personModal').style.display = 'none';
}

const expenseManager = new ExpenseManager();

// Modal functions for admin features
function toggleLock() {
    expenseManager.currentAction = 'lock';
    document.getElementById('passwordModal').style.display = 'block';
}

function showArchiveModal() {
    document.getElementById('archiveModal').style.display = 'block';
}

function closeArchiveModal() {
    document.getElementById('archiveModal').style.display = 'none';
    document.getElementById('archivePassword').value = '';
}

function confirmArchive() {
    const password = document.getElementById('archivePassword').value;
    if (!password) {
        expenseManager.showNotification('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    
    expenseManager.archiveData(password);
    closeArchiveModal();
}

function showArchiveList() {
    expenseManager.loadArchiveList();
    document.getElementById('archiveListModal').style.display = 'block';
}

function closeArchiveListModal() {
    document.getElementById('archiveListModal').style.display = 'none';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    expenseManager.currentAction = null;
}

function submitPassword() {
    const password = document.getElementById('adminPassword').value;
    if (!password) {
        expenseManager.showNotification('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    
    if (expenseManager.currentAction === 'lock') {
        expenseManager.toggleLockStatus(password);
    }
    
    closePasswordModal();
}

function refreshPeopleStats() {
    expenseManager.loadPeopleStats();
}

function closeArchiveDetailModal() {
    const modal = document.getElementById('archiveDetailModal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);