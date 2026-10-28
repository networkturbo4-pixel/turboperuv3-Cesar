# 🖐️ Guía de Instalación e Implementación Local: Terminal Biométrico ZKTeco (MB360 / MB160 / MB20)

> **TurboNetwork SaaS Core — Módulo de Recursos Humanos y Control de Asistencia**  
> Manual paso a paso para la instalación física, configuración de red en el teclado del equipo y sincronización automática en tiempo real (Huella Dactilar, Reconocimiento Facial, Tarjeta RFID y PIN).

---

## 1. 🔍 Diagnóstico Visual de tu Equipo ZKTeco (Según Fotos Enviadas)

El equipo de tus fotografías corresponde a la serie **ZKTeco Multi-Biométrica (MB360 / MB160 / MB20)** con:
- **Doble cámara infrarroja/visible (derecha)**: Para **Reconocimiento Facial** (se observa activa en tu segunda foto).
- **Lector óptico de huella dactilar (centro-izquierda)**: Sensor ZK Optical iluminado en verde.
- **Lector de tarjetas RFID (`💳`)**: Ubicado a la izquierda del sensor de huella.
- **Teclado físico 4x4**: Con tecla **`M/OK`** (abajo a la derecha) para entrar al menú de configuración.

### ¿Qué significan los iconos que aparecen arriba a la derecha en tu pantalla (`09:12`)?
En tu segunda foto, la barra superior muestra **4 iconos de estado** de izquierda a derecha:
1. ⚠️ **Triángulo amarillo de advertencia**: Indica que el equipo aún no tiene administrador asignado o requiere verificar ajustes iniciales.
2. 🖥️ **Monitor con indicador verde**: Indica la interfaz de **Red Ethernet (LAN)**.
3. 🔌 **Icono de energía**: Alimentación eléctrica 12V DC conectada correctamente.
4. 🗄️🚫 **Dos cilindros negros con círculo rojo (Servidor ADMS / Nube desconectado)**: **¡Este es el icono clave!** Significa que el reloj tiene activo el módulo de **Servidor de Nube (ADMS)**, pero aún no apunta a la IP de tu servidor TurboNetwork (`192.168.1.54:3000`). En cuanto ingreses la IP y puerto en el menú del ZKTeco, **ese círculo rojo cambiará a un check VERDE (`✅`)** y el reloj enviará cada marcación de huella o rostro automáticamente.

---

## 2. 🛠️ Paso 1: Instalación Física y Conexión de Red en el Local

1. **Ubicación y Altura Recomendada**:
   - Instala el soporte metálico en la pared de ingreso a la oficina a una altura de **1.15 m a 1.20 m del suelo** (medido hasta la cámara del equipo). Esto permite que la cámara dual capture el rostro cómodamente para personas de entre 1.50 m y 1.90 m sin que tengan que agacharse.
   - Evita que le dé luz solar directa de frente a las cámaras infrarrojas.
2. **Conexión de Cables (Parte Trasera del ZKTeco)**:
   - **Alimentación**: Conecta el transformador de **12V DC / 1.5A** al conector de energía.
   - **Red Local (LAN RJ45)**: Conecta un cable de red UTP (Cat5e o Cat6) desde el puerto **Ethernet (RJ45)** detrás del ZKTeco hacia un puerto LAN de tu **Router o Switch principal de la oficina** (la misma red `192.168.1.X` donde está conectada tu PC servidor).

---

## 3. 🌐 Paso 2: Configuración de Red e IP en el Teclado del ZKTeco

Tu red local de oficina opera en el segmento **`192.168.1.X`** (Puerta de enlace `192.168.1.1`) y tu servidor TurboNetwork tiene la IP **`192.168.1.54`** en el puerto **`3000`**.

Realiza estos pasos directamente en el teclado físico del ZKTeco:

### A. Asignar IP Fija al Reloj ZKTeco (`Red -> Ethernet`)
1. Presiona la tecla **`M/OK`** (abajo a la derecha) para abrir el **Menú Principal**.
2. Con las flechas muévete hasta el icono **🌐 Red (Comm.)** y presiona **`M/OK`**.
3. Entra en **Ethernet** y presiona **`M/OK`**.
4. Configura los siguientes valores usando el teclado numérico:
   - **Dirección IP**: `192.168.1.201` *(IP fija libre en tu red local)*
   - **Máscara de Subred**: `255.255.255.0`
   - **Puerta de Enlace (Gateway)**: `192.168.1.1`
   - **DNS**: `8.8.8.8`
   - **Puerto TCP**: `4370`
   - **DHCP**: `Desactivado (OFF)` *(para que la IP del reloj nunca cambie si se apaga el router)*
5. Presiona **`ESC`** para guardar y volver al menú **Red**.

### B. Conectar el ZKTeco en Tiempo Real con TurboNetwork (`Servidor de Nube / ADMS`)
1. Dentro del mismo menú **🌐 Red (Comm.)**, baja hasta **Configuración de Servidor de Nube** *(en algunos firmwares aparece como **Servidor ADMS** o **Cloud Server**)* y presiona **`M/OK`**.
2. Configura exactamente estos valores:
   - **Modo de Nombre de Dominio (Enable Domain Name)**: `Desactivado (OFF)`
   - **Dirección del Servidor (Server Address)**: **`192.168.1.54`** *(La IP de tu PC donde corre TurboNetwork)*
   - **Puerto del Servidor (Server Port)**: **`3000`**
   - **Habilitar Servidor Proxy**: `Desactivado (OFF)`
3. Presiona **`ESC`** dos veces hasta volver a la pantalla principal del reloj (`09:15`).
4. **Verificación inmediata**: Observa el icono de los dos servidores negros arriba a la derecha (`🗄️`). En **5 a 10 segundos** cambiará el círculo rojo (`🚫`) por un **círculo verde (`✅`)**. ¡Eso confirma que el reloj ya está enlazado en vivo con TurboNetwork!

---

## 4. 👤 Paso 3: Registrar a los Trabajadores (Huella y Rostro)

Para que el sistema reconozca de quién es cada marcación, el **ID de Usuario** en el ZKTeco debe coincidir con el **ID** (o **DNI**) del trabajador en TurboNetwork:

| ID en ZKTeco (`ID de Usuario`) | DNI (También válido) | Nombre del Colaborador en TurboNetwork | Cargo |
| :---: | :---: | :--- | :--- |
| **`1`** | `74214636` | **César Administrador** | Gerente General / Admin |
| **`2`** | `45981273` | **Ing. Alejandro Torres** | Ingeniero Principal de Redes |
| **`3`** | `72109845` | **Ana Morales** | Coordinadora de Cobranzas |
| **`4`** | `41982734` | **Luis Lopez** | Especialista FTTH & Soporte |

### Cómo registrar la Huella y el Rostro en el ZKTeco:
1. Presiona **`M/OK`** -> **👤 Usuarios** -> **Nuevo Usuario**.
2. **ID de Usuario**: Escribe **`1`** (para César), **`2`** (para Alejandro), **`3`** (para Ana), **`4`** (para Luis), o el número de **DNI** del trabajador.
3. **Nombre**: Escribe el nombre del trabajador.
4. **Huella**: Selecciona **Huella**, elige el dedo índice y colócalo **3 veces seguidas** sobre el lector óptico verde hasta que diga *"Registro exitoso"*.
5. **Rostro**: Selecciona **Rostro**, mira de frente a la cámara dual centrando los ojos en el recuadro verde de la pantalla hasta que se complete la barra al 100%.
6. Presiona **`ESC`** para guardar.

---

## 5. ✅ Paso 4: Prueba en Vivo de Entrada y Salida

1. Con el ZKTeco en la pantalla principal (`Bienvenido`), coloca tu **dedo en el lector** o **mira a la cámara**.
2. El ZKTeco dirá: *"Acceso correcto / Gracias"* y mostrará tu nombre e ID en pantalla.
3. En **menos de 2 segundos**, el ZKTeco enviará automáticamente la marcación a `http://192.168.1.54:3000/iclock/cdata`.
4. Entra a **TurboNetwork -> Recursos Humanos -> Control de Asistencia**:
   - Verás la marcación registrada automáticamente con la insignia **`🖐️ Huella Oficina`** (indicando si fue por **Huella Dactilar ZKTeco** o **Reconocimiento Facial ZKTeco**), la hora exacta y el cálculo automático de puntualidad o tardanza.

---

## 6. 🔌 Endpoints Activos en TurboNetwork para Diagnóstico y Sincronización

| Endpoint | Método | Función |
| :--- | :---: | :--- |
| `/iclock/cdata` | `GET` / `POST` | Receptor nativo **ADMS Push** del reloj ZKTeco (recibe huellas `VERIFY=1`, rostros `VERIFY=15` y tarjetas `VERIFY=4` en tiempo real). |
| `/iclock/getrequest` | `GET` | Heartbeat que mantiene el icono del servidor en **verde (`✅`)** en la pantalla del ZKTeco. |
| `/api/rrhh/zkteco/status` | `GET` | Muestra la IP del servidor (`192.168.1.54:3000`), los relojes ZKTeco conectados en vivo y la tabla de IDs de empleados. |
| `/api/rrhh/zkteco/test-lan` | `POST` | Prueba la conexión TCP directa al puerto `4370` de la IP del ZKTeco (`192.168.1.201`). |
| `/api/rrhh/attendance/biometric-sync` | `POST` | Sincronización manual o por script desde la interfaz web. |


---

## 7. ?? Configuraci�n para Producci�n (sistemasisp.tech)

Cuando desees que el reloj biom�trico ZKTeco env�e las marcaciones directamente al servidor en producci�n en la nube:

1. Entra a **M/OK** -> **Red** -> **Configuraci�n de Servidor de Nube (ADMS)**.
2. Configura los siguientes par�metros:
   - **Habilitar Servidor de Nube**: \S� / ON\
   - **Habilitar Servidor Proxy**: \Desactivado (OFF)\
   - **Opci�n A (Por IP directa - Recomendada)**:
     - **Modo de Nombre de Dominio**: \Desactivado (OFF)\
     - **Direcci�n del Servidor**: \179.236.230.204\
     - **Puerto del Servidor**: \80\ *(HTTP est�ndar, en Nginx de producci�n)*
   - **Opci�n B (Por Nombre de Dominio)**:
     - **Modo de Nombre de Dominio**: \Activado (ON)\
     - **Nombre de Dominio**: \sistemasisp.tech\
     - **Puerto del Servidor**: \80\
     - *(Requiere que en Red -> Ethernet el DNS est� configurado en 8.8.8.8)*
3. El icono de servidor (dos cilindros) cambiar� a check verde (\?\) y las marcaciones entrar�n en vivo al sistema en la nube.

