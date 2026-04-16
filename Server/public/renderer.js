/**
 * IMPERIUM Map Renderer (Hex Canvas)
 */

export class MapRenderer {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = state;
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.setupInteractions();
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    setupInteractions() {
        let isDragging = false;
        let lastX, lastY;

        this.canvas.onmousedown = (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        };

        window.onmousemove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            // Move camera (scaled by zoom)
            this.state.map.viewX -= dx / this.state.map.zoom;
            this.state.map.viewY -= dy / this.state.map.zoom;

            lastX = e.clientX;
            lastY = e.clientY;
            this.render();
        };

        window.onmouseup = () => isDragging = false;

        this.canvas.onwheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.state.map.zoom = Math.max(10, Math.min(100, this.state.map.zoom * delta));
            this.render();
        };

        this.canvas.onclick = (e) => {
            // Screen to Tile conversion
            const rect = this.canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            
            this.handleTileClick(sx, sy);
        };
    }

    render() {
        const { ctx, canvas, state } = this;
        const { tiles, viewX, viewY, zoom } = state.map;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Constants for Hex math
        const side = zoom;
        const h = Math.sin(Math.PI / 6) * side;
        const r = Math.cos(Math.PI / 6) * side;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        for (const tile of tiles) {
            // Calculation for axial staggered hex layout
            // offset half-row every even row
            const xOffset = (tile.y % 2) * r;
            const px = centerX + (tile.x - viewX) * (r * 2) + xOffset;
            const py = centerY + (tile.y - viewY) * (side + h);

            // Culling (don't draw if far off screen)
            if (px < -r * 2 || px > canvas.width + r * 2 || py < -side * 2 || py > canvas.height + side * 2) continue;

            this.drawHex(px, py, side, tile);
        }
    }

    drawHex(x, y, side, tile) {
        const { ctx } = this;
        const h = Math.sin(Math.PI / 6) * side;
        const r = Math.cos(Math.PI / 6) * side;

        ctx.beginPath();
        ctx.moveTo(x, y - side);
        ctx.lineTo(x + r, y - h);
        ctx.lineTo(x + r, y + h);
        ctx.lineTo(x, y + side);
        ctx.lineTo(x - r, y + h);
        ctx.lineTo(x - r, y - h);
        ctx.closePath();

        // Fill based on terrain
        const terrainColors = {
            'Gg': '#3d5e3a', // Grass
            'Ww': '#1a3a5e', // Water
            'Mm': '#4a4a4a', // Mountain
            'Ff': '#1a4a1a', // Forest
            'Hh': '#5e4a3a'  // Hills
        };

        ctx.fillStyle = terrainColors[tile.terrain] || '#222';
        ctx.fill();

        // Outline
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // If structure (City/Fortress)
        if (tile.structure_id) {
            ctx.fillStyle = 'rgba(212, 175, 55, 0.5)'; // Gold tint
            ctx.fill();
            
            // Center Dot for buildings
            ctx.beginPath();
            ctx.arc(x, y, side / 4, 0, Math.PI * 2);
            ctx.fillStyle = '#d4af37';
            ctx.fill();
        }

        // Label (optional, based on zoom)
        if (this.state.map.zoom > 30) {
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${tile.x},${tile.y}`, x, y + 5);
        }
    }

    handleTileClick(sx, sy) {
        // Find nearest tile
        const { tiles, viewX, viewY, zoom } = this.state.map;
        const side = zoom;
        const h = Math.sin(Math.PI / 6) * side;
        const r = Math.cos(Math.PI / 6) * side;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        let closest = null;
        let minDist = Infinity;

        for (const tile of tiles) {
            const xOffset = (tile.y % 2) * r;
            const px = centerX + (tile.x - viewX) * (r * 2) + xOffset;
            const py = centerY + (tile.y - viewY) * (side + h);

            const d = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
            if (d < minDist && d < side) {
                minDist = d;
                closest = tile;
            }
        }

        if (closest) {
            this.state.map.selectedTile = closest;
            this.showInspection(closest);
        }
    }

    showInspection(tile) {
        const panel = document.getElementById('tile-inspector');
        panel.classList.remove('hidden');
        
        document.getElementById('inspect-title').textContent = tile.structure_id || 'Wilderness';
        document.getElementById('inspect-coords').textContent = `Coords: ${tile.x}, ${tile.y} | Terrain: ${tile.terrain}`;
        document.getElementById('inspect-stats').innerHTML = `
            <p>Level: ${tile.level}</p>
            <p>Defense: ${tile.siege_hp} / ${tile.max_siege_hp}</p>
        `;
    }
}
