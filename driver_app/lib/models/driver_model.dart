class DriverModel {
  final String id;
  final String driverName;
  final String phone;
  final String vehicleType;
  final String vehicleNumber;
  final String? dlNumber;
  final String? city;
  final String? shift;
  final double rating;
  String? avatarUrl;
  bool onDuty;
  final String? token;

  DriverModel({
    required this.id,
    required this.driverName,
    required this.phone,
    required this.vehicleType,
    required this.vehicleNumber,
    this.dlNumber,
    this.city,
    this.shift,
    this.rating = 4.9,
    this.avatarUrl,
    this.onDuty = true,
    this.token,
  });

  factory DriverModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return DriverModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      driverName: json['driver_name'] ?? json['name'] ?? 'Rudraksha Rider',
      phone: (json['phone'] ?? '').toString(),
      vehicleType: json['vehicle_type'] ?? 'Bike',
      vehicleNumber: json['vehicle_number'] ?? '',
      dlNumber: json['dl_number'] ?? 'RJ14-VERIFIED',
      city: json['city'] ?? 'Jaipur',
      shift: json['shift'] ?? 'Full Time',
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 4.9,
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
      'city': city,
      'shift': shift,
      'rating': rating,
      'avatar_url': avatarUrl,
      'onDuty': onDuty,
      'token': token,
    };
  }

  DriverModel copyWith({
    String? id,
    String? driverName,
    String? phone,
    String? vehicleType,
    String? vehicleNumber,
    String? dlNumber,
    String? city,
    String? shift,
    double? rating,
    String? avatarUrl,
    bool? onDuty,
    String? token,
  }) {
    return DriverModel(
      id: id ?? this.id,
      driverName: driverName ?? this.driverName,
      phone: phone ?? this.phone,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      dlNumber: dlNumber ?? this.dlNumber,
      city: city ?? this.city,
      shift: shift ?? this.shift,
      rating: rating ?? this.rating,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      onDuty: onDuty ?? this.onDuty,
      token: token ?? this.token,
    );
  }
}
