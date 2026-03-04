// Manage font selection and loading for the Text Tool

const defaultFonts = [
    { name: '微軟正黑體', family: '"Microsoft JhengHei", sans-serif' },
    { name: '標楷體', family: 'DFKai-sb, serif' },
    { name: '新細明體', family: 'PMingLiU, serif' },
    { name: '思源黑體 (Noto Sans)', family: '"Noto Sans TC", sans-serif' },
    { name: '思源宋體 (Noto Serif)', family: '"Noto Serif TC", serif' },
    { name: 'Arial', family: 'Arial, sans-serif' },
    { name: 'Times New Roman', family: '"Times New Roman", serif' }
];

function initFontDropdown() {
    const select = document.getElementById('text-font');
    if (!select) return;

    // Load defaults
    defaultFonts.forEach(font => {
        const option = document.createElement('option');
        option.value = font.family;
        option.textContent = font.name;
        option.style.fontFamily = font.family; // Show a preview in the dropdown if the browser allows
        select.appendChild(option);
    });

    // Check Local Font Access API
    const loadBtn = document.getElementById('btn-load-fonts');
    if ('queryLocalFonts' in window) {
        loadBtn.classList.remove('hidden');
        loadBtn.addEventListener('click', async () => {
            try {
                // Request permission and get fonts
                const fonts = await window.queryLocalFonts();

                // If successful, clear and populate
                select.innerHTML = '';

                // Add an option group for Local Fonts
                const optGroup = document.createElement('optgroup');
                optGroup.label = '系統本機字型';

                // Use a Set to avoid duplicate families mapping to multiple styles here
                const uniqueFamilies = new Set();

                // Sort fonts alphabetically by family
                fonts.sort((a, b) => a.family.localeCompare(b.family));

                fonts.forEach(font => {
                    if (!uniqueFamilies.has(font.family)) {
                        uniqueFamilies.add(font.family);
                        const option = document.createElement('option');
                        option.value = `"${font.family}"`;
                        option.textContent = font.family;
                        // Performance note: setting inline fontFamily for hundreds of options might slow down some browsers slightly, but usually acceptable
                        option.style.fontFamily = `"${font.family}"`;
                        optGroup.appendChild(option);
                    }
                });

                // Add defaults back at the top
                const defaultGroup = document.createElement('optgroup');
                defaultGroup.label = '預設字型';
                defaultFonts.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font.family;
                    option.textContent = font.name;
                    option.style.fontFamily = font.family;
                    defaultGroup.appendChild(option);
                });

                select.appendChild(defaultGroup);
                select.appendChild(optGroup);

                // Hide button after loading
                loadBtn.style.display = 'none';

            } catch (err) {
                console.error('Failed to load local fonts:', err);
                alert('無法載入本機字型，因為缺少授權或權限被拒絕。');
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initFontDropdown);
