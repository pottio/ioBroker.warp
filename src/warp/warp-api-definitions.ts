import { Param, WarpApi, WarpApiSection } from './models';

export class WarpApiDefinitions {
    public readonly deletedParameterIds: { [version: string]: string[]; } = {
        '0.0.1': [],
        '0.0.2': ['esp'],
        '0.1.0': ['info.version', 'info.model', 'info.product', 'evse', 'meter'],
    }
    private readonly _warpProduct: string;
    private _definedSections: WarpApiSection[] = [];

    constructor(warpProduct: string) {
        this._warpProduct = warpProduct;
        this._definedSections = [
            ...this.defineEvse().sections,
            ...this.defineMeter().sections,
            ...this.defineNfc().sections,
            ...this.defineChargeManager().sections,
            ...this.defineMqtt().sections,
            ...this.defineWifi().sections,
            ...this.defineEthernet().sections,
            ...this.defineAuthentication().sections,
            ...this.defineOthers()
        ];
    }

    public getAllSections = (): WarpApiSection[] => this._definedSections;
    public getAllSectionsForProduct = (): WarpApiSection[] => this.getAllSections().filter(section => section.hasParametersFor(this._warpProduct));
    public getSectionByTopicForProduct = (topic: string): WarpApiSection | undefined => this.getAllSectionsForProduct().find(section => section.topic === topic);
    public getSectionByIdForProduct = (id: string): WarpApiSection | undefined => this.getAllSectionsForProduct().find(section => id.includes(section.id));


    private defineEvse(): WarpApi {
        const evse = new WarpApi('evse', 'Charge controller');
        evse.add('evse/state', 'The state of the charge controller', [
            Param.enum('iec61851_state', { 0: 'NOT_CONNECTED', 1: 'CONNECTED', 2: 'CHARGING', 3: 'CHARGING_WITH_VENTILATION', 4: 'ERROR' }).withDescription('The current state according to IEC 61851').build(),
            Param.enum('charger_state', { 0: 'NOT_CONNECTED', 1: 'CONNECTED', 2: 'CHARGING', 3: 'ERROR' }).withDescription('The current status, processed by the charge controller').build(),
            Param.enum('contactor_state', { 0: 'NOT_LIVE_BEFORE_AND_AFTER_CONTRACTOR', 1: 'LIVE_BEFORE_BUT_NOT_AFTER_CONTRACTOR', 2: 'NOT_LIVE_BEFORE_BUT_AFTER_CONTRACTOR', 3: 'LIVE_BEFORE_AND_AFTER_CONTRACTOR' }).withDescription('The voltage before and after the contactor is monitored').build(),
            Param.numb('contactor_error').withDescription('Error code of the contactor monitoring. A value other than 0 indicates an error').build(),
            Param.numb('allowed_charging_current', 'mA').withDescription('Maximum allowed charging current provided to the vehicle').build(),
            Param.enum('error_state', { 0: 'OK', 1: 'SWITCH_ERROR', 2: 'CALIBRATION_ERROR', 3: 'CONTRACTOR_ERROR', 4: 'COMMUNICATION_ERROR' }).withDescription('The current error state').build(),
            Param.enum('lock_state', { 0: 'INIT', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED', 4: 'OPENING', 5: 'ERROR' }).withDescription('State of the cable lock (only relevant for wallboxes with type 2 socket)').build(),
            Param.enum('dc_fault_current_state', { 0: 'NO_ERROR', 1: '6_MA_FAULT_CURRENT', 2: 'SYSTEM_ERROR', 3: 'UNKNOWN_ERROR', 4: 'CALIBRATION_ERROR' }).onlyWarp2().withDescription('The state of the DC residual current protection module').build()
        ]);
        evse.add('evse/hardware_configuration', 'The hardware configuration of the charge controller', [
            Param.enum('jumper_configuration', { 0: '6_AMPERE', 1: '10_AMPERE', 2: '13_AMPERE', 3: '16_AMPERE', 4: '20_AMPERE', 5: '25_AMPERE', 6: '32_AMPERE', 7: 'CONTROLLED_BY_SOFTWARE', 8: 'NOT_CONFIGURED' }).withDescription('The maximum current of the incoming cable. This current is configured on the charge controller by jumpers or a plug-in board with switches').build(),
            Param.bool('has_lock_switch').withDescription('Indicates whether the wallbox has a cable lock').build(),
            Param.enum('evse_version', { 14: 'EVSE_1_4', 15: 'EVSE_1_5', 20: 'EVSE_2_0' }).withDescription('Hardware version of the charge controller').build(),
            Param.enum('energy_meter_type', { 0: 'NO_METER', 1: 'SDM72', 2: 'SDM630', 3: 'SDM72V2' }).onlyWarp2().withDescription('Hardware version of the charge controller').build(),
        ]);
        evse.add('evse/slots', 'The state of the charging slots', [
            Param.list('slots', 'json').withDescription('Last 10 slots').build()
        ]);
        evse.add('evse/button_state', 'The status of the button in the front panel', [
            Param.numb('button_press_time', 'ms').withDescription('Time at which the button was last pressed. 0 if the button has not been pressed since the charge controller was started').build(),
            Param.numb('button_release_time', 'ms').withDescription('Time at which the button was last released. 0 if the button has not been pressed since the charge controller was started').build(),
            Param.bool('button_pressed').withDescription('true, if the button is currently pressed, otherwise false').build()
        ]);
        evse.add('evse/indicator_led', 'The state of the LED in the button', [
            Param.numb('indication').withDescription('-1 = Controlled by EVSE; 0 = Off; 1-254 = Dimmed; 255 = On; 1001 = Confirming flashing; 1002 = Rejecting flashing; 1003 = Prompting flashing').build(),
            Param.numb('duration', 'ms').withDescription('Duration for which the set state is maintained').build()
        ]);
        evse.add('evse/low_level_state', 'The low-level state of the charge controller', [
            Param.enum('led_state', { 0: 'OFF', 1: 'ON', 2: 'FLASHING', 3: 'FLICKERING', 4: 'BREATHES', 5: 'API' }).withDescription('The status of the LED connected to the charge controller').build(),
            Param.numb('cp_pwm_duty_cycle', '%/10').withDescription('Pulse width modulation duty cycle on the CP signal').build(),
            Param.list('adc_values', 'number').onlyWarp1().withDescription('16-bit ADC raw values of the voltage measurements: CP/PE | PP/PE').build(),
            Param.list('adc_values', 'number').onlyWarp2().withDescription('16-bit ADC raw values of the voltage measurements: CP/PE before resistor (PWM High) | CP/PE after resistor (PWM High) | CP/PE before resistor (PWM Low) | CP/PE after resistor (PWM Low) | +12V Rail | -12V Rail').build(),
            Param.list('voltages', 'number').onlyWarp1().withDescription('Voltages [mV] calculated from the ADC values: CP/PE | PP/PE | Maximum voltage CP/PE').build(),
            Param.list('voltages', 'number').onlyWarp2().withDescription('Voltages [mV] calculated from the ADC values: CP/PE before resistor (PWM High) | CP/PE after resistor (PWM High) | CP/PE before resistor (PWM Low) | CP/PE after resistor (PWM Low) | PP/PE | +12V Rail | -12V Rail').build(),
            Param.list('resistances', 'number').withDescription('Resistors [Ω] calculated from the voltages: CP/PE | PP/PE').build(),
            Param.list('gpio', 'bool').onlyWarp1().withDescription('Signals on the GPIOs: Input | Output | Motor input switch | Relais | Motor error').build(),
            Param.list('gpio', 'bool').onlyWarp2().withDescription('Signals on the GPIOs: Input | Power configuration 0 | Motor error | Direct current error | Power configuration 1 | DC fault current protection test | Shutdown | Button | CP-PWM | Motor input switch | Contactor control | Configurable output | CP disconnection | Motor active | Motor phase | Contactor test before | Contactor test after | Configurable input | DC X6 | DC X30 | LED').build(),
            Param.numb('charging_time', 'ms').withDescription('Approximate time of the charging process. To be used for charge management purposes only!').build(),
            Param.numb('time_since_state_change', 'ms').withDescription('Time since the last IEC 61851 state change. If the state is 2 (= B: Charging).build(), this value corresponds to the charging time').build(),
            Param.numb('uptime', 'ms').withDescription('Time since starting the charge controller').build(),
        ]);
        evse.add('evse/external_current', 'The charging current specified by the external controller', [
            Param.numb('current', 'mA', 0, 32000).withDescription('The charging current specified by the external controller').actionUpdateValue('evse/external_current_update', `{ "current": # }`).build()
        ]);
        evse.add('evse/external_clear_on_disconnect', 'Specifies whether the charge current specified by the external charge control should be automatically set to 0 when a vehicle is unplugged', [
            Param.bool('clear_on_disconnect').withDescription('Specifies whether the charge current specified by the external charge control should be automatically set to 0 when a vehicle is unplugged').actionUpdateValue('evse/external_clear_on_disconnect_update', `{ "clear_on_disconnect": # }`).build()
        ]);
        evse.add('evse/management_current', 'The charging current specified by the charge management', [
            Param.numb('current', 'mA', 0, 32000).withDescription('The charging current specified by the charge management').actionUpdateValue('evse/management_current_update', `{ "current": # }`).build()
        ]);
        evse.add('evse/auto_start_charging', 'Configures whether a connected vehicle is charged independently', [
            Param.bool('auto_start_charging').withDescription('Configures whether a connected vehicle is charged independently. If activated, the charging process starts immediately when the vehicle is connected').actionUpdateValue('evse/auto_start_charging_update', `{ "auto_start_charging": # }`).build()
        ]);
        evse.add('evse/global_current', 'The charging current specified via the web interface', [
            Param.numb('current', 'mA', 0, 32000).withDescription('The charging current specified via the web interface').actionUpdateValue('evse/global_current_update', `{ "current": # }`).build()
        ]);
        evse.add('evse/management_enabled', 'Indicates whether the charge management charging slot is active', [
            Param.bool('enabled').withDescription('Indicates whether the charge management charging slot is active').actionUpdateValue('evse/management_enabled_update', `{ "enabled": # }`).build()
        ]);
        evse.add('evse/user_current', 'The charging current allowed by the user authorisation', [
            Param.numb('current', 'mA', 0, 32000).withDescription('The charging current allowed by the user authorisation').actionUpdateValue('evse/user_current_update', `{ "current": # }`).build()
        ]);
        evse.add('evse/user_enabled', 'Indicates whether the charging slot of the user authorisation is active', [
            Param.bool('enabled').withDescription('Indicates whether the charging slot of the user authorisation is active').actionUpdateValue('evse/user_enabled_update', `{ "enabled": # }`).build()
        ]);
        evse.add('evse/external_enabled', 'Indicates whether the charging slot of the external control is active', [
            Param.bool('enabled').withDescription('Indicates whether the charging slot of the external control is active').actionUpdateValue('evse/external_enabled_update', `{ "enabled": # }`).build()
        ]);
        evse.add('evse/external_defaults', 'The settings of the charging slot of the external controller taken over after a restart of the charge controller', [
            Param.numb('current', 'mA', 0, 32000).withDescription('The maximum current in the charging slot of the external control taken over after a restart').actionUpdateConfig('evse/external_defaults_update').build(),
            Param.bool('clear_on_disconnect').withDescription('Indicates whether the charging current of this slot is set to 0 when a vehicle is unplugged').actionUpdateConfig('evse/external_defaults_update').build()
        ]);
        evse.add('evse/gpio_configuration', 'The configuration of the configurable inputs and outputs', [
            Param.enum('shutdown_input', { 0: 'NOT_CONFIGURED', 1: 'TURN_OFF_WHEN_OPENED', 2: 'TURN_OFF_WHEN_CLOSED' }).onlyWarp2().withDescription('The configuration of the switch-off input').actionUpdateConfig('evse/gpio_configuration_update').build(),
            Param.enum('input', { 0: 'NOT_CONFIGURED' }).onlyWarp2().withDescription('The configuration of the configurable input').actionUpdateConfig('evse/gpio_configuration_update').build(),
            Param.enum('output', { 0: 'CONNECTED_TO_GROUND', 1: 'HIGH_IMPEDANCE' }).onlyWarp2().withDescription('The configuration of the configurable output').actionUpdateConfig('evse/gpio_configuration_update').build()
        ]);
        evse.add('evse/button_configuration', 'The configuration of the button in the front panel', [
            Param.enum('button', { 0: 'DEACTIVATED', 1: 'CHARGE_START_WHEN_PRESSED', 2: 'CHARGE_STOP_WHEN_PRESSED', 3: 'CHARGE_TOGGLE_WHEN_PRESSED' }).onlyWarp2().withDescription('The configuration of the button in the front panel').actionUpdateConfig('evse/button_configuration_update').build()
        ]);
        evse.add('evse/user_calibration', 'Allows the factory calibration of the EVSE to be read and overwritten', [
            Param.bool('user_calibration_active').onlyWarp1().withDescription('Indicates whether the factory calibration has been overwritten').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_diff').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_mul').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_div').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('resistance_2700').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.json('resistance_880').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build()
        ]);
        evse.add('evse/reset_dc_fault_current_state', 'The state of the DC fault current protection module. If a DC fault occurs, charging is no longer possible until the protection module has been reset. Before resetting, it is imperative that the reason for the fault is rectified!', [
            Param.butt('reset_dc_fault_current_state', 'normal').withDescription('Resets the DC residual current protection module. Before resetting, it is imperative that the reason for the fault is rectified!').actionSendCommand('evse/reset_dc_fault_current_state', 'PUT', `{ "password": "0xDC42FA23" }`).build()
        ]);
        evse.add('evse/manual_charging', 'Allows to start and stop a charging process, when auto start charging is disabled.', [
            Param.butt('start_charging', 'start').withDescription('Starts a charging process').actionSendCommand('evse/start_charging', 'PUT').build(),
            Param.butt('stop_charging', 'stop').withDescription('Stops a charging process').actionSendCommand('evse/stop_charging', 'PUT').build()
        ]);
        return evse;
    }

    private defineMeter(): WarpApi {
        const meter = new WarpApi('meter', 'Electric meter');
        meter.add('meter/state', 'The state of the electricity meter', [
            Param.enum('state', { 0: 'NO_METER_CONNECTED', 1: 'METER_UNRELIABLE', 2: 'METER_CONNECTED' }).withDescription('The state of the electricity meter').build(),
            Param.enum('type', { 0: 'NO_METER', 1: 'SDM72', 2: 'SDM630', 3: 'SDM72V2' }).withDescription('Hardware version of the charge controller').build(),
        ]);
        meter.add('meter/values', 'The measured values of the electricity meter', [
            Param.numb('power', 'W').withDescription('The current charging power').build(),
            Param.numb('energy_rel', 'kWh').withDescription('The charged energy since the last reset').build(),
            Param.numb('energy_abs', 'kWh').withDescription('The charged energy since the production of the electricity meter').build(),
        ]);
        meter.add('meter/phases', 'Connected and active phases', [
            Param.list('phases_active', 'bool').onlyWarp2().withDescription('Active phases: L1 | L2 | L3').build(),
            Param.list('phases_connected', 'bool').onlyWarp2().withDescription('Connected phases: L1 | L2 | L3').build(),
        ]);
        meter.add('meter/error_counters', 'Error counter of the communication with the electricity meter', [
            Param.numb('meter').onlyWarp1().withDescription('Communication error between RS485 Bricklet and electricity meter').build(),
            Param.numb('bricklet').onlyWarp1().withDescription('Communication error between ESP Brick and RS485 Bricklet').build(),
            Param.numb('bricklet_reset').onlyWarp1().withDescription('Unexpected resets of the RS485 Bricklet').build(),
            Param.numb('local_timeout').onlyWarp2().withDescription('Local timeout').build(),
            Param.numb('global_timeout').onlyWarp2().withDescription('Global timeout').build(),
            Param.numb('illegal_function').onlyWarp2().withDescription('Illegal function').build(),
            Param.numb('illegal_data_access').onlyWarp2().withDescription('Illegal data access').build(),
            Param.numb('illegal_data_value').onlyWarp2().withDescription('Illegal data value').build(),
            Param.numb('slave_device_failure').onlyWarp2().withDescription('Slave device failure').build(),
        ]);
        meter.add('meter/all_values', 'All measured values measured by the built-in electricity meter', [
            Param.list('all_values', 'number').onlyWarp2().withDescription('Voltage [V] against neutral L1 | L2 | L3 | Power [A] L1 | L2 | L3 | Active power [W] L1 | L2 | L3 | Apparent power [VA] L1 | L2 | L3 | Reactive power [var] L1 | L2 | L3 | Power factor L1 | L2 | L3 | Relative phase shift [°] L1 | L2 | L3' +
                ' | Avg voltage against neutral [V] | Avg power [A] | Total phase currents [A] | Total active power [W] | Total apparent power [VA] | Total reactive power [var] | Total power factor | Total relative phase shift [°] | Frequency of the supply voltage [Hz]' +
                ' | Active energy (import; taken from the vehicle) [kWh] | Active energy (export; delivered from the vehicle) [kWh] | Reactive energy (import; taken from the vehicle) [kvarh] | Reactive energy (export; delivered from the vehicle) [kvarh] | Total apparent energy [kVAh]' +
                ' | Transported electric charge [Ah] | Used active power [W] | Max. used active power [W] | Used apparent power [VA] | Max. used apparent power [VA] | Used neutral conductor power [A] | Max. used neutral conductor power [A] | Voltage L1 to L2 [V] | Voltage L2 to L3 [V] | Voltage L3 to L1 [V]' +
                ' | Avg voltage between phases [V] | Neutral conductor power [A] | THD of voltage [%] L1 | L2 | L3 | THD of power [%] L1 | L2 | l3 | THD of voltage [%] | THD of power [%] | Used power [A] L1 | L2 | L3 | Max. used power [A] L1 | L2 | L3' +
                ' | THD voltage L1 to L2 [%] | THD voltage L2 to L3 [%] | THD voltage L3 to L1 [%] | Avg. THD voltage between phases [%] | Total active energy [kWh] | Total reactive energy [kvarh] | Active energy (import; taken from the vehicle) [kWh] L1 | L2 | L3' +
                ' | Active energy (export; delivered from the vehicle) [kWh] L1 | L2 | L3 | Total active energy [kWh]; import-export sum L1 | L2 | L3 | Reactive energy (import; taken from the vehicle) [kvarh] L1 | L2 | L3 | Reactive energy (export; delivered from the vehicle) [kvarh] L1 | L2 | L3' +
                ' | Total reactive energy [kvarh]; import-export sum L1 | L2 | L3').build()
        ]);
        meter.add('meter/reset', 'Resets the energy meter', [
            Param.butt('reset').withDescription('Resets the energy meter').actionSendCommand('meter/reset', 'PUT').build(),
        ]);
        return meter;
    }

    public defineNfc(): WarpApi {
        const nfc = new WarpApi('nfc', 'NFC charging release');
        nfc.add('nfc/seen_tags', 'The last NFC tags seen by the wallbox', [
            Param.json('last_seen_tags').onlyWarp2().withDescription('List of last seen NFC tags with tag type, tag id and milliseconds since last seen').build()
        ]);
        nfc.add('nfc/config', 'The NFC configuration', [
            Param.bool('require_tag_to_start').onlyWarp2().withDescription('Indicates whether a NFC tag is needed to start a charge.').actionUpdateConfig('nfc/config_update').build(),
            Param.bool('require_tag_to_stop').onlyWarp2().withDescription('Indicates whether a NFC tag is needed to stop a charge.').actionUpdateConfig('nfc/config_update').build(),
            Param.json('authorized_tags').onlyWarp2().withDescription('A list of authorized NFC tags.').actionUpdateConfig('nfc/config_update').build(),
        ]);
        return nfc;
    }

    public defineChargeManager(): WarpApi {
        const chargeManager = new WarpApi('charge_manager', 'Charge manager');
        chargeManager.add('charge_manager/available_current', 'The currently available power. This electricity is divided among the configured wallboxes', [
            Param.numb('current', 'mA').withDescription('The currently available power').actionUpdateValue('charge_manager/available_current_update', `{ "current": # }`).build()
        ]);
        chargeManager.add('charge_manager/state', 'The status of the charge manager and all configured wallboxes', [
            Param.enum('state', { 0: 'UNCONFIGURED', 1: 'ACTIVE', 2: 'ERROR' }).withDescription('The currently state of the charge manager').build(),
            Param.numb('uptime', 'ms').withDescription('Time since activated charge manager').build(),
            Param.json('chargers').withDescription('List of configurated wallboxes').build()
        ]);
        chargeManager.add('charge_manager/config', 'The charge manager configuration', [
            Param.bool('enable_charge_manager').withDescription('Specifies whether the charge manager should be activated').actionUpdateConfig('charge_manager/config_update').build(),
            Param.bool('enable_watchdog').withDescription('Specifies whether the watchdog should be activated').actionUpdateConfig('charge_manager/config_update').build(),
            Param.bool('verbose').withDescription('Specifies whether each power distribution is to be noted in the event log').actionUpdateConfig('charge_manager/config_update').build(),
            Param.numb('default_available_current', 'mA').withDescription('Power to be available after restarting the charge manager').actionUpdateConfig('charge_manager/config_update').build(),
            Param.numb('maximum_available_current', 'mA').withDescription('Maximum that may be set as available current via the API and the web interface. Should be configured to the maximum permitted power of the connection of the wallbox network, which is limited e.g. by the house connection, the fuse protection or the supply line').actionUpdateConfig('charge_manager/config_update').build(),
            Param.numb('minimum_current', 'mA').withDescription('Smallest amount of power to be allocated to a wallbox so that it starts a charging process. This can be used to influence how many wallboxes charge at the same time').actionUpdateConfig('charge_manager/config_update').build(),
            Param.json('chargers').withDescription('List of wallboxes that are to be controlled by the charge manager').actionUpdateConfig('charge_manager/config_update').build(),
        ]);
        return chargeManager;
    }

    public defineMqtt(): WarpApi {
        const mqtt = new WarpApi('mqtt', 'MQTT connection');
        mqtt.add('mqtt/state', 'The currently state of MQTT', [
            Param.enum('connection_state', { 0: 'NOT_CONFIGURED', 1: 'NOT_CONNECTED', 2: 'CONNECTED', 3: 'ERROR' }).withDescription('State of the connection to the MQTT broker').build(),
            Param.numb('last_error').withDescription('The last error that occurred. -1 if no error has occurred').build()
        ]);
        mqtt.add('mqtt/config', 'The MQTT configuration', [
            Param.bool('enable_mqtt').withDescription('Indicates whether an MQTT connection to the configured broker should be established').actionUpdateConfig('mqtt/config_update').build(),
            Param.text('broker_host').withDescription('Host name or IP address of the MQTT broker to which the wallbox is to connect').actionUpdateConfig('mqtt/config_update').build(),
            Param.numb('broker_port').withDescription('Port of the MQTT broker to which the wallbox should connect. Typically 1883').actionUpdateConfig('mqtt/config_update').build(),
            Param.text('broker_username').withDescription('User name with which to connect to the broker. Empty if no authentication is used').actionUpdateConfig('mqtt/config_update').build(),
            Param.text('broker_password').withDescription('Password with which to connect to the broker. Empty if no authentication is used').actionUpdateConfig('mqtt/config_update').build(),
            Param.text('global_topic_prefix').withDescription('Prefix that precedes all MQTT topics').actionUpdateConfig('mqtt/config_update').build(),
            Param.text('client_name').withDescription('Name under which the wallbox registers with the broker').actionUpdateConfig('mqtt/config_update').build(),
        ]);
        return mqtt;
    }

    public defineWifi(): WarpApi {
        const wifi = new WarpApi('wifi', 'WLAN configuration');
        wifi.add('wifi/state', 'The currently state of WLAN', [
            Param.enum('connection_state', { 0: 'NOT_CONFIGURED', 1: 'NOT_CONNECTED', 2: 'CONNECTING', 3: 'CONNECTED' }).withDescription('Status of the connection to the configured WLAN').build(),
            Param.enum('ap_state', { 0: 'DEACTIVATED', 1: 'ACTIVATED', 2: 'FALLBACK_INACTIVE', 3: 'FALLBACK_ACTIVE' }).withDescription('Status of the WLAN access point').build(),
            Param.text('ap_bssid').withDescription('BSSID of the WLAN access point').build(),
            Param.json('sta_ip').withDescription('Current IP of the wallbox in the configured network. 0.0.0.0 if there is no connection').build(),
            Param.numb('sta_rssi').withDescription('The current reception quality. 0 if there is no connection, otherwise negative. Values closer to 0 correspond to better reception').build(),
            Param.text('sta_bssid').withDescription('The BSSID of the remote station to which the wallbox is connected').build(),
        ]);
        wifi.add('wifi/scan', 'Triggers a scan for WLANs', [
            Param.butt('scan').withDescription('Triggers a scan for WLANs').actionSendCommand('wifi/scan', 'PUT').build()
        ]);
        wifi.add('wifi/sta_config', 'The WLAN connection configuration', [
            Param.bool('enable_sta').withDescription('Indicates whether a WLAN connection to the configured network should be established').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.text('ssid').withDescription('SSID to which you want to connect').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('bssid').withDescription('BSSID to be connected to').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.bool('bssid_lock').withDescription('Defines whether only the WLAN with the set BSSID is to be connected to. Leave disabled if repeaters or similar are to be used').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.text('passphrase').withDescription('The WLAN passphrase. Maximum 63 bytes').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.text('hostname').withDescription('Host name that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('ip').withDescription('IP address that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('gateway').withDescription('Gateway address that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('subnet').withDescription('Subnet mask that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('dns').withDescription('DNS server address that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
            Param.json('dns2').withDescription('Alternative DNS server address that the wallbox should use in the configured network').actionUpdateConfig('wifi/sta_config_update').build(),
        ]);
        wifi.add('wifi/ap_config', 'The WLAN access point configuration', [
            Param.bool('enable_ap').withDescription('Indicates whether the access point should be activated').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.bool('ap_fallback_only').withDescription('Specifies whether the access point should only be activated if the WLAN and LAN connections cannot be established').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.text('ssid').withDescription('SSID to which you want to connect').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.bool('hide_ssid').withDescription('True if the SSID is to be hidden, otherwise false').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.text('passphrase').withDescription('The WLAN passphrase. Maximum 63 byte').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.text('hostname').withDescription('Host name that the wallbox should use').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.numb('channel', undefined, 1, 13).withDescription('Channel on which the access point is to be accessible').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.json('ip').withDescription('IP address that the wallbox should use in the configured network').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.json('gateway').withDescription('Gateway address that the wallbox should use in the configured network').actionUpdateConfig('wifi/ap_config_update').build(),
            Param.json('subnet').withDescription('Subnet mask that the wallbox should use in the configured network').actionUpdateConfig('wifi/ap_config_update').build(),
        ]);
        return wifi;
    }

    public defineEthernet(): WarpApi {
        const ethernet = new WarpApi('ethernet', 'LAN configuration');
        ethernet.add('ethernet/state', 'The currently state of LAN', [
            Param.enum('connection_state', { 0: 'NOT_CONFIGURED', 1: 'NOT_CONNECTED', 2: 'CONNECTING', 3: 'CONNECTED' }).withDescription('Status of the connection to the configured LAN').build(),
            Param.json('ip').withDescription('Current IP of the wallbox in the configured network. 0.0.0.0 if there is no connection').build(),
            Param.bool('full_duplex').withDescription('True for a full duplex connection, otherwise false').build(),
            Param.numb('link_speed', 'Mbit/s').withDescription('Negotiated connection speed').build(),
        ]);
        ethernet.add('ethernet/sta_config', 'The WLAN connection configuration', [
            Param.bool('enable_ethernet').withDescription('Indicates whether a LAN connection to the configured network should be established').actionUpdateConfig('ethernet/config_update').build(),
            Param.text('hostname').withDescription('Host name that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
            Param.json('ip').withDescription('IP address that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
            Param.json('gateway').withDescription('Gateway address that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
            Param.json('subnet').withDescription('Subnet mask that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
            Param.json('dns').withDescription('DNS server address that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
            Param.json('dns2').withDescription('Alternative DNS server address that the wallbox should use in the configured network').actionUpdateConfig('ethernet/config_update').build(),
        ]);
        return ethernet;
    }

    public defineAuthentication(): WarpApi {
        const authentication = new WarpApi('authentication', 'Authentication configuration');
        authentication.add('authentication/config', 'The authentication configuration', [
            Param.bool('enable_auth').withDescription('Specifies whether credentials should be required').build(),
            Param.text('username').withDescription('The username').build(),
            Param.text('password').withDescription('The password').build(),
        ]);
        return authentication;
    }

    public defineOthers(): WarpApiSection[] {
        const version = new WarpApi('version', '', true);
        version.add('version', 'Version of the wallbox firmware', [
            Param.text('firmware').withDescription('The firmware version that is currently running').build(),
            Param.text('spiffs').withDescription('The version of the configuration that is currently being used').build(),
        ]);
        const modules = new WarpApi('modules', '', true);
        modules.add('modules', 'Initialization status of the firmware modules', [
            Param.bool('event_log').build(),
            Param.bool('esp32_brick').build(),
            Param.bool('wifi').build(),
            Param.bool('mqtt').build(),
            Param.bool('http').build(),
            Param.bool('ws').build(),
            Param.bool('firmware_update').build(),
            Param.bool('evse').build(),
            Param.bool('sdm72dm').build(),
            Param.bool('authentication').build(),
            Param.bool('charge_manager').build(),
            Param.bool('cm_networking').build(),
            Param.bool('nfc').build(),
        ]);
        return [...version.sections, ...modules.sections];
    }
}