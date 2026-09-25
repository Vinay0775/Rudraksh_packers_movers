class DriverModel {
  final String id;
  final String driverName;
  final String phone;
  final String vehicleType;
  final String vehicleNumber;
  final String? dlNumber;
  final String? avatarUrl;
  bool onDuty;
  final String? token;

  DriverModel({
    required this.id,
    required this.driverName,
    required this.phone,
    required this.vehicleType,
    required this.vehicleNumber,
    this.dlNumber,
    this.avatarUrl,
    this.onDuty = true,
    this.token,
  });

  factory DriverModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return DriverModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      driverName: json['driver_name'] ?? json['name'] ?? 'Rudraksha Rider',
      phone: json['phone'] ?? '',
      vehicleType: json['vehicle_type'] ?? 'Bike',
      vehicleNumber: json['vehicle_number'] ?? '',
      dlNumber: json['dl_number'],
      avatarUrl: json['avatar_url'],
      onDuty: json['onDuty'] ?? true,
      token: token ?? json['token'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'driver_name': driverName,
      'phone': phone,
      'vehicle_type': vehicleType,
      'vehicle_number': vehicleNumber,
      'dl_number': dlNumber,
      'avatar_url': avatarUrl,
      'onDuty': onDuty,
      'token': token,
    };
  }
}
