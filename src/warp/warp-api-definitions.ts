import { Param, WarpApi, WarpApiMigration, WarpApiSection } from './models';

export class WarpApiDefinitions {
    public readonly migrations: { [version: string]: WarpApiMigration; } = {
        '0.0.1': { deletedParameterIds: [], changedParameterIds: [] },
        '0.0.2': { deletedParameterIds: ['esp'], changedParameterIds: [] },
        '0.1.0': { deletedParameterIds: ['info.version', 'info.model', 'info.product'], changedParameterIds: [] },
    }
    private readonly _configuredProduct: string;
    private _definedSections: WarpApiSection[] = [];

    constructor(configuredProduct: string) {
        this._configuredProduct = configuredProduct;
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
    public getAllSectionsForConfig = (): WarpApiSection[] => this.getAllSections().filter(section => section.hasParametersFor(this._configuredProduct));
    public getSectionByTopicForConfig = (topic: string): WarpApiSection | undefined => this.getAllSectionsForConfig().find(section => section.topic === topic);
    public getSectionByIdForConfig = (id: string): WarpApiSection | undefined => this.getAllSectionsForConfig().find(section => id.includes(section.id));


    private defineEvse(): WarpApi {
        const evse = new WarpApi('evse', 'Charge controller');
        evse.add('evse/state', 'The state of the charge controller', [
            Param.enum('iec61851_state', { 0: 'NOT_CONNECTED', 1: 'CONNECTED', 2: 'CHARGING', 3: 'CHARGING_WITH_VENTILATION', 4: 'ERROR' }).withDescription('The current state according to IEC 61851').build(),
            Param.enum('vehicle_state', { 0: 'NOT_CONNECTED', 1: 'CONNECTED', 2: 'CHARGING', 3: 'ERROR' }).withDescription('The current status, processed by the charge controller').build(),
            Param.numb('contactor_error').withDescription('Error code of the contactor monitoring. A value other than 0 indicates an error').build(),
            Param.enum('charge_release', { 0: 'AUTO', 1: 'MANUAL', 2: 'DEACTIVATED' }).withDescription('Charging release. Indicates whether charging can be done automatically, manually or not').build(),
            Param.numb('allowed_charging_current', 'mA').withDescription('Maximum allowed charging current provided to the vehicle').build(),
            Param.enum('error_state', { 0: 'OK', 1: 'SWITCH_ERROR', 2: 'CALIBRATION_ERROR', 3: 'CONTRACTOR_ERROR', 4: 'COMMUNICATION_ERROR' }).withDescription('The current error state').build(),
            Param.enum('lock_state', { 0: 'INIT', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED', 4: 'OPENING', 5: 'ERROR' }).withDescription('State of the cable lock (only relevant for wallboxes with type 2 socket)').build(),
            Param.numb('time_since_state_change', 'ms').withDescription('Time since the last IEC 61851 state change. If the state is 2 (= B: Charging).build(), this value corresponds to the charging time').build(),
            Param.numb('uptime', 'ms').withDescription('Time since starting the charge controller').build()
        ]);
        evse.add('evse/hardware_configuration', 'The hardware configuration of the charge controller', [
            Param.enum('jumper_configuration', { 0: '6_AMPERE', 1: '10_AMPERE', 2: '13_AMPERE', 3: '16_AMPERE', 4: '20_AMPERE', 5: '25_AMPERE', 6: '32_AMPERE', 7: 'CONTROLLED_BY_SOFTWARE', 8: 'NOT_CONFIGURED' }).withDescription('The maximum current of the incoming cable. This current is configured on the charge controller by jumpers or a plug-in board with switches').build(),
            Param.bool('has_lock_switch').withDescription('Indicates whether the wallbox has a cable lock').build()
        ]);
        evse.add('evse/low_level_state', 'The low-level state of the charge controller', [
            Param.bool('low_level_mode_enabled').onlyWarp1().withDescription('Indicates whether low-level mode is active. Currently not supported').build(),
            Param.enum('led_state', { 0: 'OFF', 1: 'ON', 2: 'FLASHING', 3: 'FLICKERING', 4: 'BREATHES' }).withDescription('The status of the LED connected to the charge controller').build(),
            Param.numb('cp_pwm_duty_cycle', '%/10').withDescription('Pulse width modulation duty cycle on the CP signal').build(),
            Param.list('adc_values').onlyWarp1().withDescription('16-bit ADC raw values of the voltage measurements')
                .item(Param.numb('cp_pe').withDescription('CP/PE').build())
                .item(Param.numb('pp_pe').withDescription('PP/PE').build())
                .build(),
            Param.list('adc_values').onlyWarp2().withDescription('16-bit ADC raw values of the voltage measurements')
                .item(Param.numb('cp_pe_before_resistor_pwm_high').withDescription('CP/PE before resistor (PWM High)').build())
                .item(Param.numb('cp_pe_after_resistor_pwm_high').withDescription('CP/PE after resistor (PWM High)').build())
                .item(Param.numb('cp_pe_before_resistor_pwm_low').withDescription('CP/PE before resistor (PWM Low)').build())
                .item(Param.numb('cp_pe_after_resistor_pwm_low').withDescription('CP/PE after resistor (PWM Low)').build())
                .item(Param.numb('pp_pe').withDescription('PP/PE').build())
                .item(Param.numb('pos_12v_rail').withDescription('+12V Rail').build())
                .item(Param.numb('neg_12v_rail').withDescription('-12V Rail').build())
                .build(),
            Param.list('voltages').onlyWarp1().withDescription('Voltages calculated from the ADC values')
                .item(Param.numb('cp_pe', 'mV').withDescription('CP/PE').build())
                .item(Param.numb('pp_pe', 'mV').withDescription('PP/PE').build())
                .item(Param.numb('max_voltage_cp_pe', 'mV').withDescription('Maximum voltage CP/PE').build())
                .build(),
            Param.list('voltages').onlyWarp2().withDescription('Voltages calculated from the ADC values')
                .item(Param.numb('cp_pe_before_resistor_pwm_high', 'mV').withDescription('CP/PE before resistor (PWM High)').build())
                .item(Param.numb('cp_pe_after_resistor_pwm_high', 'mV').withDescription('CP/PE after resistor (PWM High)').build())
                .item(Param.numb('cp_pe_before_resistor_pwm_low', 'mV').withDescription('CP/PE before resistor (PWM Low)').build())
                .item(Param.numb('cp_pe_after_resistor_pwm_low', 'mV').withDescription('CP/PE after resistor (PWM Low)').build())
                .item(Param.numb('pp_pe', 'mV').withDescription('PP/PE').build())
                .item(Param.numb('pos_12v_rail', 'mV').withDescription('+12V Rail').build())
                .item(Param.numb('neg_12v_rail', 'mV').withDescription('-12V Rail').build())
                .build(),
            Param.list('resistances').withDescription('Resistors calculated from the voltages')
                .item(Param.numb('cp_pe', 'Ω').withDescription('CP/PE').build())
                .item(Param.numb('pp_pe', 'Ω').withDescription('PP/PE').build())
                .build(),
            Param.list('gpio').onlyWarp1().withDescription('Signals on the GPIOs')
                .item(Param.bool('input').withDescription('Input').build())
                .item(Param.bool('output').withDescription('Output').build())
                .item(Param.bool('motor_input_switch').withDescription('Motor input switch').build())
                .item(Param.bool('relais').withDescription('Relais').build())
                .item(Param.bool('motor_error').withDescription('Motor error').build())
                .build(),
            Param.list('gpio').onlyWarp2().withDescription('Signals on the GPIOs')
                .item(Param.bool('input').withDescription('Input').build())
                .item(Param.bool('power_configuration_0').withDescription('Power configuration 0').build())
                .item(Param.bool('motor_error').withDescription('Motor error').build())
                .item(Param.bool('dc_error').withDescription('Direct current error').build())
                .item(Param.bool('power_configuration_1').withDescription('Power configuration 1').build())
                .item(Param.bool('dc_fault_current_protection_test').withDescription('DC fault current protection test').build())
                .item(Param.bool('shutdown').withDescription('Shutdown').build())
                .item(Param.bool('button').withDescription('Button').build())
                .item(Param.bool('cp_pwm').withDescription('CP-PWM').build())
                .item(Param.bool('motor_input_switch').withDescription('Motor input switch').build())
                .item(Param.bool('contactor_control').withDescription('Contactor control').build())
                .item(Param.bool('configurable_output').withDescription('Configurable output').build())
                .item(Param.bool('cp_disconnection').withDescription('CP disconnection').build())
                .item(Param.bool('motor_active').withDescription('Motor active').build())
                .item(Param.bool('motor_phase').withDescription('Motor phase').build())
                .item(Param.bool('contactor_test_before').withDescription('Contactor test before').build())
                .item(Param.bool('contactor_test_after').withDescription('Contactor test after').build())
                .item(Param.bool('configurable_input').withDescription('Configurable input').build())
                .item(Param.bool('dc_x6').withDescription('DC X6').build())
                .item(Param.bool('dc_x30').withDescription('DC X30').build())
                .item(Param.bool('led').withDescription('LED').build())
                .build(),
            Param.numb('hardware_version').onlyWarp1().withDescription('The hardware version of the EVSE detected by the firmware of the EVSE').build(),
            Param.numb('charging_time', 'ms').withDescription('Approximate time of the charging process. To be used for load management purposes only!').build()
        ]);
        evse.add('evse/max_charging_current', 'The maximum charge currents of the charge controller. The minimum of these currents is the actual maximum charging current provided to the vehicle. All currents have a minimum value of 6000 (6 amps) and a maximum value of 32000 (32 amps)', [
            Param.numb('max_current_configured', 'mA').withDescription('The maximum configured charging current').actionUpdateValue('evse/current_limit', `{ "current": # }`).build(),
            Param.numb('max_current_incoming_cable', 'mA').withDescription('The maximum charging current of the incoming cable').build(),
            Param.numb('max_current_outgoing_cable', 'mA').withDescription('The maximum charging current of the outgoing cable').build(),
            Param.numb('max_current_managed', 'mA', 0, 32000).withDescription('The maximum charge current allocated by the load manager. Ignored if load management is deactivated').actionUpdateValue('evse/managed_current_update', `{ "current": # }`).build()
        ]);
        evse.add('evse/auto_start_charging', 'Configures whether a connected vehicle is charged independently', [
            Param.bool('auto_start_charging').withDescription('Configures whether a connected vehicle is charged independently. If activated, the charging process starts immediately when the vehicle is connected').actionUpdateValue('evse/auto_start_charging_update', `{ "auto_start_charging": # }`).build()
        ]);
        evse.add('evse/user_calibration', 'Allows the factory calibration of the EVSE to be read and overwritten', [
            Param.bool('user_calibration_active').onlyWarp1().withDescription('Indicates whether the factory calibration has been overwritten').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_diff').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_mul').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('voltage_div').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.numb('resistance_2700').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build(),
            Param.json('resistance_880').onlyWarp1().withDescription('One of the calibration parameters').actionUpdateConfig('evse/user_calibration_update').build()
        ]);
        evse.add('evse/energy_meter_state', 'With WARP 2, the electricity meter is read by the charge controller itself', [
            Param.bool('available').onlyWarp2().withDescription('Indicates whether an electricity meter has been found').build(),
            Param.list('error_count').onlyWarp2().withDescription('Error counter of the communication with the electricity meter')
                .item(Param.numb('local_timeouts', 'Local Timeouts').build())
                .item(Param.numb('global_timeouts', 'Global Timeouts').build())
                .item(Param.numb('illegal_function', 'Illegal Function').build())
                .item(Param.numb('illegal_data_access', 'Illegal Data Access').build())
                .item(Param.numb('illegal_data_value', 'Illegal Data Value').build())
                .item(Param.numb('slave_device_failure', 'Slave Device Failure').build())
                .build()
        ]);
        // evse.add('evse/energy_meter_values', 'With WARP 2, the electricity meter is read by the charge controller itself', [
        //     Param.numb('power', 'W').onlyModelPro().onlyWarp2().withDescription('The current charging power').build(),
        //     Param.numb('energy_rel', 'kWh').onlyModelPro().onlyWarp2().withDescription('The charged energy since the last reset').build(),
        //     Param.numb('energy_abs', 'kWh').onlyModelPro().onlyWarp2().withDescription('The charged energy since the electricity meter was manufactured').build(),
        //     Param.list('phases_active').onlyModelPro().onlyWarp2().withDescription('The currently active phases')
        //         .item(Param.bool('l1').withDescription('L1 phase active').build())
        //         .item(Param.bool('l2').withDescription('L2 phase active').build())
        //         .item(Param.bool('l3').withDescription('L3 phase active').build())
        //         .build(),
        //     Param.list('phases_connected').onlyModelPro().onlyWarp2().withDescription('The currently connected phases')
        //         .item(Param.bool('l1').withDescription('L1 phase connected').build())
        //         .item(Param.bool('l2').withDescription('L2 phase connected').build())
        //         .item(Param.bool('l3').withDescription('L3 phase connected').build())
        //         .build()
        // ]);
        evse.add('evse/dc_fault_current_state', 'The state of the DC fault current protection module. If a DC fault occurs, charging is no longer possible until the protection module has been reset. Before resetting, it is imperative that the reason for the fault is rectified!', [
            Param.enum('state', { 0: 'NO_ERROR', 1: 'FAULT_CURRENT_DETECTED', 2: 'SYSTEM_ERROR', 3: 'UNKNOWN_ERROR', 4: 'CALIBRATION_ERROR' }).onlyWarp2().withDescription('The current charging power').onlyWarp2().build(),
            Param.butt('reset_dc_fault_current', 'normal').onlyWarp2().withDescription('Resets the DC residual current protection module. Before resetting, it is imperative that the reason for the fault is rectified!').actionSendCommand('evse/reset_dc_fault_current', 'PUT', `{ "password": "0xDC42FA23" }`).build()
        ]);
        evse.add('evse/gpio_configuration', 'The configuration of the configurable inputs and outputs', [
            Param.enum('shutdown_input', { 0: 'NOT_CONFIGURED', 1: 'TURN_OFF_WHEN_OPENED', 2: 'TURN_OFF_WHEN_CLOSED' }).onlyWarp2().withDescription('The configuration of the switch-off input').actionUpdateConfig('evse/gpio_configuration_update').build(),
            Param.enum('input', { 0: 'NOT_CONFIGURED' }).onlyWarp2().withDescription('The configuration of the configurable input').actionUpdateConfig('evse/gpio_configuration_update').build(),
            Param.enum('output', { 0: 'CONNECTED_TO_GROUND', 1: 'HIGH_IMPEDANCE' }).onlyWarp2().withDescription('The configuration of the configurable output').actionUpdateConfig('evse/gpio_configuration_update').build()
        ]);
        evse.add('evse/button_configuration', 'The configuration of the button in the front panel', [
            Param.enum('button', { 0: 'DEACTIVATED', 1: 'CHARGE_START_WHEN_PRESSED', 2: 'CHARGE_STOP_WHEN_PRESSED', 3: 'CHARGE_TOGGLE_WHEN_PRESSED' }).onlyWarp2().withDescription('The configuration of the button in the front panel').actionUpdateConfig('evse/button_configuration_update').build()
        ]);
        evse.add('evse/button_state', 'The status of the button in the front panel', [
            Param.numb('button_press_time', 'ms').withDescription('Time at which the button was last pressed. 0 if the button has not been pressed since the charge controller was started').build(),
            Param.numb('button_release_time', 'ms').withDescription('Time at which the button was last released. 0 if the button has not been pressed since the charge controller was started').build(),
            Param.bool('button_pressed').withDescription('true, if the button is currently pressed, otherwise false').build()
        ]);
        evse.add('evse/managed', 'Determines whether the charging current allocated by the load manager is included in the calculation of the maximum charging current', [
            Param.bool('managed').withDescription('true if load management is activated, otherwise false').actionUpdateValue('evse/managed_update', `{ "managed": # }`).build()
        ]);
        evse.add('evse/manual_charging', 'Allows to start and stop a charging process, when auto start charging is disabled.', [
            Param.butt('start_charging', 'start').withDescription('Starts a charging process').actionSendCommand('evse/start_charging', 'PUT').build(),
            Param.butt('stop_charging', 'stop').withDescription('Stops a charging process').actionSendCommand('evse/start_charging', 'PUT').build()
        ]);
        return evse;
    }

    private defineMeter(): WarpApi {
        const meter = new WarpApi('meter', 'Electric meter');
        // meter.add('meter/state', 'The state of the electricity meter', [
        //     Param.enum('state', { 0: 'NO_METER_CONNECTED', 1: 'METER_UNRELIABLE', 2: 'METER_CONNECTED' }).onlyModelPro().onlyWarp1().withDescription('The state of the electricity meter').build(),
        //     Param.numb('power', 'W').onlyModelPro().withDescription('The current charging power').build(),
        //     Param.numb('energy_rel', 'kWh').onlyModelPro().withDescription('The charged energy since the last reset').build(),
        //     Param.numb('energy_abs', 'kWh').onlyModelPro().withDescription('The charged energy since the electricity meter was manufactured').build(),
        //     Param.list('phases_active').onlyModelPro().onlyWarp2().withDescription('The currently active phases')
        //         .item(Param.bool('l1').withDescription('L1 phase active').build())
        //         .item(Param.bool('l2').withDescription('L2 phase active').build())
        //         .item(Param.bool('l3').withDescription('L3 phase active').build())
        //         .build(),
        //     Param.list('phases_connected').onlyModelPro().onlyWarp2().withDescription('The currently connected phases')
        //         .item(Param.bool('l1').withDescription('L1 phase connected').build())
        //         .item(Param.bool('l2').withDescription('L2 phase connected').build())
        //         .item(Param.bool('l3').withDescription('L3 phase connected').build())
        //         .build()
        // ]);
        // meter.add('meter/error_counters', 'Error counter of the communication with the electricity meter', [
        //     Param.numb('meter').onlyModelPro().onlyWarp1().withDescription('Communication error between RS485 Bricklet and electricity meter').build(),
        //     Param.numb('bricklet').onlyModelPro().onlyWarp1().withDescription('Communication error between ESP Brick and RS485 Bricklet').build(),
        //     Param.numb('bricklet_reset').onlyModelPro().onlyWarp1().withDescription('Unexpected resets of the RS485 Bricklet').build(),
        // ]);
        // meter.add('meter/detailed_values', 'All measured values measured by the built-in electricity meter', [
        //     Param.list('detailed_values').onlyModelPro()
        //         .item(Param.numb('voltage_against_neutral_l1', 'V').withDescription('Voltage against neutral L1').build())
        //         .item(Param.numb('voltage_against_neutral_l2', 'V').withDescription('Voltage against neutral L2').build())
        //         .item(Param.numb('voltage_against_neutral_l3', 'V').withDescription('Voltage against neutral L3').build())
        //         .item(Param.numb('power_l1', 'A').withDescription('Power L1').build())
        //         .item(Param.numb('power_l2', 'A').withDescription('Power L2').build())
        //         .item(Param.numb('power_l3', 'A').withDescription('Power L3').build())
        //         .item(Param.numb('active_power_l1', 'W').withDescription('Active power L1').build())
        //         .item(Param.numb('active_power_l2', 'W').withDescription('Active power L2').build())
        //         .item(Param.numb('active_power_l3', 'W').withDescription('Active power L3').build())
        //         .item(Param.numb('apparent_power_l1', 'VA').withDescription('Apparent power L1').build())
        //         .item(Param.numb('apparent_power_l2', 'VA').withDescription('Apparent power L2').build())
        //         .item(Param.numb('apparent_power_l3', 'VA').withDescription('Apparent power L3').build())
        //         .item(Param.numb('reactive_power_l1', 'var').withDescription('Reactive power L1').build())
        //         .item(Param.numb('reactive_power_l2', 'var').withDescription('Reactive power L2').build())
        //         .item(Param.numb('reactive_power_l3', 'var').withDescription('Reactive power L3').build())
        //         .item(Param.numb('power_factor_l1').withDescription('Power factor L1; The sign of the power factor indicates the direction of the current flow').build())
        //         .item(Param.numb('power_factor_l2').withDescription('Power factor L2; The sign of the power factor indicates the direction of the current flow').build())
        //         .item(Param.numb('power_factor_l3').withDescription('Power factor L3; The sign of the power factor indicates the direction of the current flow').build())
        //         .item(Param.numb('relative_phase_shift_l1', '°').withDescription('Relative phase shift L1').build())
        //         .item(Param.numb('relative_phase_shift_l2', '°').withDescription('Relative phase shift L2').build())
        //         .item(Param.numb('relative_phase_shift_l3', '°').withDescription('Relative phase shift L3').build())
        //         .item(Param.numb('average_voltage_against_neutral', 'V').withDescription('Average voltage against neutral').build())
        //         .item(Param.numb('average_power', 'A').withDescription('Average power').build())
        //         .item(Param.numb('total_phase_currents', 'A').withDescription('Total phase currents').build())
        //         .item(Param.numb('total_active_power', 'W').withDescription('Total active power').build())
        //         .item(Param.numb('total_apparent_power', 'VA').withDescription('Total apparent power').build())
        //         .item(Param.numb('total_reactive_power', 'var').withDescription('Total reactive power').build())
        //         .item(Param.numb('total_power_factor').withDescription('Total power factor').build())
        //         .item(Param.numb('total_relative_phase_shift', '°').withDescription('Total relative phase shift').build())
        //         .item(Param.numb('frequency_of_the_supply_voltage', 'Hz').withDescription('Frequency of the supply voltage').build())
        //         .item(Param.numb('active_energy_import', 'kWh').withDescription('Active energy (import; taken from the vehicle)').build())
        //         .item(Param.numb('active_energy_export', 'kWh').withDescription('Active energy (export; delivered from the vehicle)').build())
        //         .item(Param.numb('reactive_energy_import', 'kvarh').withDescription('Reactive energy (import; taken from the vehicle)').build())
        //         .item(Param.numb('reactive_energy_export', 'kvarh').withDescription('Reactive energy (export; delivered from the vehicle)').build())
        //         .item(Param.numb('total_apparent_energy', 'kVAh').withDescription('Total apparent energy').build())
        //         .item(Param.numb('transported_electric_charge', 'Ah').withDescription('Transported electric charge').build())
        //         .item(Param.numb('used_active_power', 'W').withDescription('Used active power; corresponds to import-export difference').build())
        //         .item(Param.numb('max_used_active_power', 'W').withDescription('Maximum used active power; highest measured value').build())
        //         .item(Param.numb('used_apparent_power', 'VA').withDescription('Used apparent power; corresponds to import-export difference').build())
        //         .item(Param.numb('max_used_apparent_power', 'VA').withDescription('Maximum used apparent power; highest measured value').build())
        //         .item(Param.numb('used_neutral_conductor_power', 'A').withDescription('Used neutral conductor power').build())
        //         .item(Param.numb('max_used_neutral_conductor_power', 'A').withDescription('Maximum used neutral conductor power; highest measured value').build())
        //         .item(Param.numb('voltage_l1_to_l2', 'V').withDescription('Voltage L1 to L2').build())
        //         .item(Param.numb('voltage_l2_to_l3', 'V').withDescription('Voltage L2 to L3').build())
        //         .item(Param.numb('voltage_l3_to_l1', 'V').withDescription('Voltage L3 to L1').build())
        //         .item(Param.numb('average_voltage_between_phases', 'V').withDescription('Average voltage between phases').build())
        //         .item(Param.numb('neutral_conductor_power', 'A').withDescription('Neutral conductor power').build())
        //         .item(Param.numb('thd_voltage_l1', '%').withDescription('Total harmonic distortion (THD) of voltage L1').build())
        //         .item(Param.numb('thd_voltage_l2', '%').withDescription('Total harmonic distortion (THD) of voltage L2').build())
        //         .item(Param.numb('thd_voltage_l3', '%').withDescription('Total harmonic distortion (THD) of voltage L3').build())
        //         .item(Param.numb('thd_power_l1', '%').withDescription('Total harmonic distortion (THD) of power L1').build())
        //         .item(Param.numb('thd_power_l2', '%').withDescription('Total harmonic distortion (THD) of power L2').build())
        //         .item(Param.numb('thd_power_l3', '%').withDescription('Total harmonic distortion (THD) of power L3').build())
        //         .item(Param.numb('thd_voltage', '%').withDescription('Total harmonic distortion (THD) of voltage').build())
        //         .item(Param.numb('thd_power', '%').withDescription('Total harmonic distortion (THD) of power').build())
        //         .item(Param.numb('used_power_l1', 'A').withDescription('Used power L1').build())
        //         .item(Param.numb('used_power_l2', 'A').withDescription('Used power L2').build())
        //         .item(Param.numb('used_power_l3', 'A').withDescription('Used power L3').build())
        //         .item(Param.numb('max_used_power_l1', 'A').withDescription('Maximum used power L1; highest measured value').build())
        //         .item(Param.numb('max_used_power_l2', 'A').withDescription('Maximum used power L2; highest measured value').build())
        //         .item(Param.numb('max_used_power_l3', 'A').withDescription('Maximum used power L3; highest measured value').build())
        //         .item(Param.numb('thd_voltage_l1_to_l2', '%').withDescription('THD voltage L1 to L2').build())
        //         .item(Param.numb('thd_voltage_l2_to_l3', '%').withDescription('THD voltage L2 to L3').build())
        //         .item(Param.numb('thd_voltage_l3_to_l1', '%').withDescription('THD voltage L3 to L1').build())
        //         .item(Param.numb('average_thd_voltage_between_phases', '%').withDescription('Average THD voltage between phases').build())
        //         .item(Param.numb('total_active_energy', 'kWh').withDescription('Total active energy; import-export sum of all phases').build())
        //         .item(Param.numb('total_reactive_energy', 'kvarh').withDescription('Total reactive energy; import-export sum of all phases').build())
        //         .item(Param.numb('active_energy_import_l1', 'kWh').withDescription('Active energy (import; taken from the vehicle) L1').build())
        //         .item(Param.numb('active_energy_import_l2', 'kWh').withDescription('Active energy (import; taken from the vehicle) L2').build())
        //         .item(Param.numb('active_energy_import_l3', 'kWh').withDescription('Active energy (import; taken from the vehicle) L3').build())
        //         .item(Param.numb('active_energy_export_l1', 'kWh').withDescription('Active energy (export; delivered from the vehicle) L1').build())
        //         .item(Param.numb('active_energy_export_l2', 'kWh').withDescription('Active energy (export; delivered from the vehicle) L2').build())
        //         .item(Param.numb('active_energy_export_l3', 'kWh').withDescription('Active energy (export; delivered from the vehicle) L3').build())
        //         .item(Param.numb('total_active_energy_export_l1', 'kWh').withDescription('Total active energy; import-export sum L1').build())
        //         .item(Param.numb('total_active_energy_export_l2', 'kWh').withDescription('Total active energy; import-export sum L2').build())
        //         .item(Param.numb('total_active_energy_export_l3', 'kWh').withDescription('Total active energy; import-export sum L3').build())
        //         .item(Param.numb('reactive_energy_import_l1', 'kvarh').withDescription('Reactive energy (import; taken from the vehicle) L1').build())
        //         .item(Param.numb('reactive_energy_import_l2', 'kvarh').withDescription('Reactive energy (import; taken from the vehicle) L2').build())
        //         .item(Param.numb('reactive_energy_import_l3', 'kvarh').withDescription('Reactive energy (import; taken from the vehicle) L3').build())
        //         .item(Param.numb('reactive_energy_export_l1', 'kvarh').withDescription('Reactive energy (export; delivered from the vehicle) L1').build())
        //         .item(Param.numb('reactive_energy_export_l2', 'kvarh').withDescription('Reactive energy (export; delivered from the vehicle) L2').build())
        //         .item(Param.numb('reactive_energy_export_l3', 'kvarh').withDescription('Reactive energy (export; delivered from the vehicle) L3').build())
        //         .item(Param.numb('total_reactive_energy_l1', 'kvarh').withDescription('Total reactive energy; import-export sum L1').build())
        //         .item(Param.numb('total_reactive_energy_l2', 'kvarh').withDescription('Total reactive energy; import-export sum L2').build())
        //         .item(Param.numb('total_reactive_energy_l3', 'kvarh').withDescription('Total reactive energy; import-export sum L3').build())
        //         .build()
        // ]);
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