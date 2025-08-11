const API_BASE_URL = 'http://localhost:5000/api'; // আপনার ব্যাকএন্ড URL দিয়ে পরিবর্তন করুন

let cart = JSON.parse(localStorage.getItem('cart')) || [];

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartCounter() {
    const cartCounter = document.getElementById('cart-counter-display');
    if (cartCounter) {
        const totalQuantity = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        cartCounter.textContent = totalQuantity;
        cartCounter.classList.toggle('show', totalQuantity > 0);
    }
}

function parsePrice(price) {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
        const numericValue = parseFloat(price.replace(/[^\d.]/g, ''));
        return isNaN(numericValue) ? 0 : numericValue;
    }
    return 0;
}

async function addToCart(productToAdd) {
    if (!productToAdd || !productToAdd.title || !productToAdd.image) {
        console.error('Invalid product data:', productToAdd);
        return null;
    }

    const price = parsePrice(productToAdd.price);
    if (price <= 0) {
        console.error('Invalid price:', productToAdd.price);
        return null;
    }

    const id = `${productToAdd.title}_${price}`;
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            id,
            title: productToAdd.title,
            price: price,
            image: productToAdd.image,
            quantity: 1
        });
    }

    saveCart();
    updateCartCounter();
    showCartNotification(productToAdd.title, productToAdd.image);

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: id,
                title: productToAdd.title,
                price: price,
                image: productToAdd.image,
                quantity: existingItem ? existingItem.quantity : 1
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to sync with server');
        }

        return cart.find(item => item.id === id);
    } catch (error) {
        console.error('Error syncing cart:', error);
        return cart.find(item => item.id === id);
    }
}

function showCartNotification(productName, imageUrl) {
    if (!productName || !imageUrl) {
        console.error('Invalid notification data:', { productName, imageUrl });
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <img src="${imageUrl}" alt="${productName}" class="notification-image" onerror="this.src='https://via.placeholder.com/100'">
            <div class="notification-text">
                <p>Added to Cart</p>
                <h4>${productName}</h4>
            </div>
        </div>`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

async function renderCartPage() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartFooter = document.getElementById('cart-footer');

    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
    
    if (!cart || cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Your cart is empty.</div>';
        if (cartFooter) cartFooter.style.display = 'none';
        return;
    }

    if (cartFooter) cartFooter.style.display = 'block';
    let subtotal = 0;

    cart.forEach((item, index) => {
        const price = parsePrice(item.price);
        const quantity = item.quantity || 1;
        const itemTotal = price * quantity;
        subtotal += itemTotal;

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <div class="cart-item-image">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/100'">
            </div>
            <div class="cart-item-details">
                <h3 class="cart-item-title">${item.title}</h3>
                <p class="cart-item-price">$${price.toFixed(2)}</p>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn decrease-btn" data-index="${index}" data-id="${item.id}">-</button>
                <span class="item-quantity">${quantity}</span>
                <button class="quantity-btn increase-btn" data-index="${index}" data-id="${item.id}">+</button>
            </div>
            <div class="item-price-total">$${itemTotal.toFixed(2)}</div>
            <button class="remove-item" data-index="${index}" data-id="${item.id}">Remove</button>
        `;
        cartItemsContainer.appendChild(cartItemEl);
    });

    const cartSummary = document.getElementById('cart-summary');
    if (cartSummary) {
        cartSummary.innerHTML = `Subtotal: <strong>$${subtotal.toFixed(2)}</strong>`;
    }

    // Background sync
    try {
        const response = await fetch(`${API_BASE_URL}/cart`);
        if (response.ok) {
            const serverCart = await response.json();
            if (serverCart && serverCart.items) {
                cart = serverCart.items;
                saveCart();
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

async function handleCartAction(action, index, itemId) {
    const item = cart[index];
    if (!item) return;

    if (action === 'increase') {
        item.quantity = (item.quantity || 1) + 1;
    } else if (action === 'decrease') {
        item.quantity = (item.quantity || 1) - 1;
        if (item.quantity <= 0) {
            cart.splice(index, 1);
        }
    } else if (action === 'remove') {
        cart.splice(index, 1);
    }

    saveCart();
    renderCartPage();
    updateCartCounter();

    try {
        await fetch(`${API_BASE_URL}/cart/${itemId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action }),
        });
    } catch (error) {
        console.error('Error syncing cart action:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');
    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            navLinks.classList.toggle('show');
        });
    }

    const productButtons = document.querySelectorAll('.product-button');
    productButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('.product-card');
            if (!card) return;

            const titleElement = card.querySelector('.product-title');
            const priceElement = card.querySelector('.product-price');
            const imageElement = card.querySelector('.product-image img');

            if (!titleElement || !priceElement || !imageElement) {
                console.error('Product card elements not found');
                return;
            }

            const product = {
                title: titleElement.textContent.trim(),
                price: priceElement.textContent,
                image: imageElement.src
            };

            addToCart(product);
        });
    });

    if (document.getElementById('cart-root')) {
        renderCartPage();

        document.getElementById('cart-items').addEventListener('click', function(event) {
            const target = event.target;
            if (!target.matches('button')) return;

            const index = parseInt(target.dataset.index);
            const itemId = target.dataset.id;
            if (isNaN(index)) return;

            if (target.classList.contains('increase-btn')) {
                handleCartAction('increase', index, itemId);
            } else if (target.classList.contains('decrease-btn')) {
                handleCartAction('decrease', index, itemId);
            } else if (target.classList.contains('remove-item')) {
                handleCartAction('remove', index, itemId);
            }
        });

        document.querySelector('.checkout')?.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const response = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        items: cart,
                        totalAmount: cart.reduce((total, item) => total + (parsePrice(item.price) * (item.quantity || 1)), 0),
                        userId: 'current-user-id'
                    }),
                });

                if (response.ok) {
                    cart = [];
                    saveCart();
                    updateCartCounter();
                    window.location.href = '/order-confirmation.html';
                } else {
                    alert('Checkout failed. Please try again.');
                }
            } catch (error) {
                console.error('Checkout error:', error);
                alert('An error occurred during checkout.');
            }
        });
    }

    const fadeInElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    fadeInElements.forEach(el => observer.observe(el));
    updateCartCounter();
});