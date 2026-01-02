// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity\public\js\dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const generateForm = document.getElementById('generateDescriptionForm');
    const descriptionOutput = document.getElementById('descriptionOutput');
    const saveProductBtn = document.getElementById('saveProductBtn');
    const catalogItemsDiv = document.getElementById('catalogItems');

    let currentGeneratedDescription = '';
    let currentProductName = '';

    // Function to load and display items from local storage
    const loadCatalog = () => {
        const catalog = JSON.parse(localStorage.getItem('productCatalog')) || [];
        catalogItemsDiv.innerHTML = ''; // Clear previous items

        if (catalog.length === 0) {
            catalogItemsDiv.innerHTML = '<p>No items in catalog yet.</p>';
            return;
        }

        catalog.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('catalog-item');
            itemDiv.innerHTML = `
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <button data-index="${index}" class="delete-item-btn">Delete</button>
            `;
            catalogItemsDiv.appendChild(itemDiv);
        });

        // Add event listeners to new delete buttons
        document.querySelectorAll('.delete-item-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const indexToDelete = event.target.dataset.index;
                deleteCatalogItem(indexToDelete);
            });
        });
    };

    // Function to delete an item from local storage
    const deleteCatalogItem = (index) => {
        const catalog = JSON.parse(localStorage.getItem('productCatalog')) || [];
        catalog.splice(index, 1); // Remove item at specific index
        localStorage.setItem('productCatalog', JSON.stringify(catalog));
        loadCatalog(); // Reload display
    };


    // Handle form submission for generating description
    generateForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const productName = document.getElementById('productName').value;
        const keywords = document.getElementById('keywords').value;

        descriptionOutput.innerHTML = '<p>Generating description, please wait...</p>';
        saveProductBtn.style.display = 'none'; // Hide save button while generating

        try {
            const response = await fetch('/api/generate-description', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productName, keywords }),
            });

            const data = await response.json();

            if (response.ok) {
                currentGeneratedDescription = data.description;
                currentProductName = productName; // Store product name for saving
                descriptionOutput.innerHTML = `<p><strong>Generated Description:</strong></p><p>${data.description}</p>`;
                saveProductBtn.style.display = 'block'; // Show save button
            } else {
                descriptionOutput.innerHTML = `<p style="color: red;">Error: ${data.error || 'Failed to generate description'}</p>`;
                saveProductBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error:', error);
            descriptionOutput.innerHTML = `<p style="color: red;">Network Error: Could not connect to the server.</p>`;
            saveProductBtn.style.display = 'none';
        }
    });

    // Handle saving the product to local storage
    saveProductBtn.addEventListener('click', () => {
        if (currentGeneratedDescription && currentProductName) {
            const productCatalog = JSON.parse(localStorage.getItem('productCatalog')) || [];
            productCatalog.push({
                name: currentProductName,
                description: currentGeneratedDescription,
                generatedAt: new Date().toISOString()
            });
            localStorage.setItem('productCatalog', JSON.stringify(productCatalog));
            alert('Product saved to local catalog!');
            saveProductBtn.style.display = 'none'; // Hide after saving
            document.getElementById('productName').value = ''; // Clear form
            document.getElementById('keywords').value = '';
            descriptionOutput.innerHTML = '<p>Generated Description will appear here...</p>';
            loadCatalog(); // Refresh catalog display
        }
    });

    // Initial load of catalog when the page loads
    loadCatalog();
});