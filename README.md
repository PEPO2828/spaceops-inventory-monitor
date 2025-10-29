# SpaceOps Inventory Monitor

## Descripción
Aplicación web para monitorear y gestionar el inventario de suministros en estaciones espaciales y misiones de larga duración. Permite a los usuarios rastrear el stock, registrar el uso y la adición de suministros, y recibir alertas sobre niveles críticos.

## Características

*   **Gestión de Suministros:** Crea, actualiza y elimina registros de suministros.
*   **Control de Stock:** Añade o consume stock de cualquier suministro.
*   **Registro de Uso:** Mantiene un historial detallado de todas las transacciones de stock.
*   **Estado de Suministros:** Clasifica los suministros como "OK", "Advertencia" o "Crítico" según los días de cobertura proyectados.
*   **Dashboard Interactivo:**
    *   **KPIs:** Visualiza métricas clave como el total de suministros, suministros en riesgo (Críticos/Advertencia) y el **Artículo Más Consumido en los Últimos 30 Días**.
    *   **Alertas:** Notificaciones en tiempo real para suministros en estado de advertencia o crítico.
    *   **Filtros y Búsqueda:** Busca suministros por nombre, categoría o filtra por estado de bajo stock.
*   **Vista Detallada del Artículo:** Gráfico de historial de stock y registro de uso para cada suministro individual.
*   **Persistencia de Datos:** Los datos se guardan localmente en el navegador (LocalStorage).

## Stack Tecnológico

*   **Frontend:**
    *   HTML5
    *   CSS3 (con variables CSS para theming)
    *   JavaScript (ES6+)
    *   [Chart.js](https://www.chartjs.org/) (para visualización de datos)
    *   [Chartjs-plugin-annotation](https://www.chartjs.org/chartjs-plugin-annotation/latest/) (para anotaciones en gráficos)
*   **Arquitectura:**
    *   **Diseño Modular:** La aplicación está estructurada en módulos lógicos (`utils`, `domain`, `store`, `services`, `ui`) para promover la separación de responsabilidades, facilitar la mantenibilidad y mejorar la escalabilidad.
    *   **Patrón de Repositorio:** Se utiliza un patrón de repositorio (`SupplyRepository`, `UsageLogRepository`) para abstraer la capa de acceso a datos (LocalStorage), permitiendo un fácil cambio de la fuente de datos en el futuro sin afectar la lógica de negocio.
    *   **Persistencia de Datos:** Los datos se almacenan y recuperan utilizando el `LocalStorage` del navegador, lo que permite que la aplicación funcione sin un backend y persista la información entre sesiones del usuario.

## Principios de Diseño

*   **Separación de Responsabilidades (SoC):** Cada módulo tiene una responsabilidad única y bien definida (ej. `utils` para funciones de utilidad, `domain` para la lógica de negocio, `services` para la orquestación, `ui` para la presentación).
*   **Inyección de Dependencias (DI):** Los servicios y componentes reciben sus dependencias (ej. `supplyRepository` en `InventoryService`) en lugar de crearlas internamente, lo que mejora la flexibilidad y la capacidad de prueba.
*   **Mínimo Acoplamiento:** Los componentes están diseñados para tener la menor dependencia posible entre sí, lo que facilita los cambios y la reutilización.
*   **Simplicidad y Claridad:** El código busca ser directo y fácil de entender, priorizando la legibilidad.

## Instalación y Uso

Para ejecutar esta aplicación localmente:

1.  Clona este repositorio o descarga los archivos.
2.  Abre el archivo `index.html` en tu navegador web.

No se requiere ninguna configuración de servidor ni dependencias externas (aparte de los CDNs de Chart.js).

## Cambios Recientes

*   **KPI "Artículo Más Consumido (Últimos 30 Días)":** Se ha implementado un nuevo KPI en el dashboard que muestra el suministro más consumido en los últimos 30 días, reemplazando el anterior "Global Coverage".
*   **Mejoras Visuales:**
    *   Se ha aumentado el tamaño de la fuente para el título principal y el subtítulo en el encabezado.
    *   Se ha aumentado el tamaño de la fuente del texto en el pie de página.
    *   Se ha centrado el contenido de la columna "Acciones" en las tablas para una mejor alineación.

## Contribuciones
Las contribuciones son bienvenidas. Por favor, abre un 'issue' o envía un 'pull request' con tus mejoras.

## Licencia
Este proyecto está bajo la licencia MIT.