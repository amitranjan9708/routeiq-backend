import json

cities = [
    {"name": "Agra", "lat": 27.1767, "lng": 78.0081, "apt": "Agra Airport", "stn": "Agra Cantt"},
    {"name": "Varanasi", "lat": 25.3176, "lng": 82.9739, "apt": "Lal Bahadur Shastri Airport", "stn": "Varanasi Junction"},
    {"name": "Kanpur", "lat": 26.4499, "lng": 80.3319, "apt": "Kanpur Airport", "stn": "Kanpur Central"},
    {"name": "Nagpur", "lat": 21.1458, "lng": 79.0882, "apt": "Dr. Babasaheb Ambedkar Int. Airport", "stn": "Nagpur Junction"},
    {"name": "Visakhapatnam", "lat": 17.6868, "lng": 83.2185, "apt": "Visakhapatnam Airport", "stn": "Visakhapatnam Junction"},
    {"name": "Thiruvananthapuram", "lat": 8.5241, "lng": 76.9366, "apt": "Trivandrum Int. Airport", "stn": "Thiruvananthapuram Central"},
    {"name": "Madurai", "lat": 9.9252, "lng": 78.1198, "apt": "Madurai Airport", "stn": "Madurai Junction"},
    {"name": "Coimbatore", "lat": 11.0168, "lng": 76.9558, "apt": "Coimbatore Int. Airport", "stn": "Coimbatore Junction"},
    {"name": "Jodhpur", "lat": 26.2389, "lng": 73.0243, "apt": "Jodhpur Airport", "stn": "Jodhpur Junction"},
    {"name": "Udaipur", "lat": 24.5854, "lng": 73.7125, "apt": "Maharana Pratap Airport", "stn": "Udaipur City"},
    {"name": "Amritsar", "lat": 31.6340, "lng": 74.8723, "apt": "Sri Guru Ram Dass Jee Int. Airport", "stn": "Amritsar Junction"},
    {"name": "Dehradun", "lat": 30.3165, "lng": 78.0322, "apt": "Jolly Grant Airport", "stn": "Dehradun Station"},
    {"name": "Ranchi", "lat": 23.3441, "lng": 85.3096, "apt": "Birsa Munda Airport", "stn": "Ranchi Junction"},
    {"name": "Raipur", "lat": 21.2514, "lng": 81.6296, "apt": "Swami Vivekananda Airport", "stn": "Raipur Junction"},
    {"name": "Mysore", "lat": 12.2958, "lng": 76.6394, "apt": "Mysore Airport", "stn": "Mysuru Junction"},
    {"name": "Mangalore", "lat": 12.9141, "lng": 74.8560, "apt": "Mangaluru Int. Airport", "stn": "Mangaluru Central"},
    {"name": "Vijayawada", "lat": 16.5062, "lng": 80.6480, "apt": "Vijayawada Airport", "stn": "Vijayawada Junction"},
    {"name": "Tirupati", "lat": 13.6288, "lng": 79.4192, "apt": "Tirupati Airport", "stn": "Tirupati Main"},
    {"name": "Vadodara", "lat": 22.3072, "lng": 73.1812, "apt": "Vadodara Airport", "stn": "Vadodara Junction"},
    {"name": "Rajkot", "lat": 22.3039, "lng": 70.8022, "apt": "Rajkot Airport", "stn": "Rajkot Junction"},
    {"name": "Aurangabad", "lat": 19.8762, "lng": 75.3433, "apt": "Aurangabad Airport", "stn": "Aurangabad Station"},
    {"name": "Nashik", "lat": 19.9975, "lng": 73.7898, "apt": "Nashik Airport", "stn": "Nashik Road"},
    {"name": "Gwalior", "lat": 26.2183, "lng": 78.1828, "apt": "Gwalior Airport", "stn": "Gwalior Junction"},
    {"name": "Jabalpur", "lat": 23.1815, "lng": 79.9864, "apt": "Jabalpur Airport", "stn": "Jabalpur Junction"},
    {"name": "Jamshedpur", "lat": 22.8046, "lng": 86.2029, "apt": "Sonari Airport", "stn": "Tatanagar Junction"},
    {"name": "Siliguri", "lat": 26.7271, "lng": 88.3953, "apt": "Bagdogra Airport", "stn": "New Jalpaiguri"},
    {"name": "Gorakhpur", "lat": 26.7606, "lng": 83.3732, "apt": "Gorakhpur Airport", "stn": "Gorakhpur Junction"},
    {"name": "Prayagraj", "lat": 25.4358, "lng": 81.8463, "apt": "Prayagraj Airport", "stn": "Prayagraj Junction"},
    {"name": "Jammu", "lat": 32.7266, "lng": 74.8570, "apt": "Jammu Airport", "stn": "Jammu Tawi"},
    {"name": "Srinagar", "lat": 34.0837, "lng": 74.7973, "apt": "Sheikh ul-Alam Int. Airport", "stn": "Srinagar Station"},
    {"name": "Leh", "lat": 34.1526, "lng": 77.5771, "apt": "Kushok Bakula Rimpochee Airport", "stn": None},
    {"name": "Shillong", "lat": 25.5788, "lng": 91.8933, "apt": "Shillong Airport", "stn": "Guwahati Station"}, # Closest railhead
    {"name": "Agartala", "lat": 23.8315, "lng": 91.2868, "apt": "Maharaja Bir Bikram Airport", "stn": "Agartala Station"},
    {"name": "Dibrugarh", "lat": 27.4728, "lng": 94.9120, "apt": "Dibrugarh Airport", "stn": "Dibrugarh Town"},
    {"name": "Silchar", "lat": 24.8333, "lng": 92.7789, "apt": "Silchar Airport", "stn": "Silchar Station"},
    {"name": "Pune", "lat": 18.5204, "lng": 73.8567, "apt": "Pune Airport", "stn": "Pune Junction"},
    {"name": "Ludhiana", "lat": 30.9010, "lng": 75.8573, "apt": "Sahnewal Airport", "stn": "Ludhiana Junction"},
    {"name": "Patiala", "lat": 30.3398, "lng": 76.3869, "apt": None, "stn": "Patiala Station"},
    {"name": "Kozhikode", "lat": 11.2588, "lng": 75.7804, "apt": "Calicut Int. Airport", "stn": "Kozhikode Main"},
    {"name": "Kochi", "lat": 9.9312, "lng": 76.2673, "apt": "Cochin Int. Airport", "stn": "Ernakulam Junction"},
    {"name": "Tiruchirappalli", "lat": 10.7905, "lng": 78.7047, "apt": "Tiruchirappalli Int. Airport", "stn": "Tiruchirappalli Junction"},
    {"name": "Bhubaneswar", "lat": 20.2961, "lng": 85.8245, "apt": "Biju Patnaik Airport", "stn": "Bhubaneswar Station"},
    {"name": "Rourkela", "lat": 22.2604, "lng": 84.8536, "apt": "Rourkela Airport", "stn": "Rourkela Junction"},
    {"name": "Bhopal", "lat": 23.2599, "lng": 77.4126, "apt": "Raja Bhoj Airport", "stn": "Bhopal Junction"},
    {"name": "Indore", "lat": 22.7196, "lng": 75.8577, "apt": "Devi Ahilya Bai Holkar Airport", "stn": "Indore Junction"},
    {"name": "Ujjain", "lat": 23.1765, "lng": 75.7885, "apt": None, "stn": "Ujjain Junction"},
    {"name": "Gaya", "lat": 24.7914, "lng": 85.0002, "apt": "Gaya Airport", "stn": "Gaya Junction"},
    {"name": "Bhagalpur", "lat": 25.2425, "lng": 86.9842, "apt": None, "stn": "Bhagalpur Junction"},
    {"name": "Muzaffarpur", "lat": 26.1209, "lng": 85.3647, "apt": None, "stn": "Muzaffarpur Junction"},
    {"name": "Darbhanga", "lat": 26.1542, "lng": 85.8918, "apt": "Darbhanga Airport", "stn": "Darbhanga Junction"},
    {"name": "Bareilly", "lat": 28.3670, "lng": 79.4304, "apt": "Bareilly Airport", "stn": "Bareilly Junction"},
    {"name": "Aligarh", "lat": 27.8974, "lng": 78.0880, "apt": None, "stn": "Aligarh Junction"},
    {"name": "Moradabad", "lat": 28.8386, "lng": 78.7733, "apt": None, "stn": "Moradabad Junction"},
    {"name": "Saharanpur", "lat": 29.9640, "lng": 77.5460, "apt": None, "stn": "Saharanpur Junction"},
    {"name": "Jhansi", "lat": 25.4484, "lng": 78.5685, "apt": None, "stn": "VGLB Jhansi Junction"},
    {"name": "Belagavi", "lat": 15.8497, "lng": 74.4977, "apt": "Belagavi Airport", "stn": "Belagavi Station"},
    {"name": "Hubballi", "lat": 15.3647, "lng": 75.1240, "apt": "Hubballi Airport", "stn": "Hubballi Junction"},
    {"name": "Kolhapur", "lat": 16.7050, "lng": 74.2433, "apt": "Kolhapur Airport", "stn": "Chhatrapati Shahu Maharaj Terminus"},
    {"name": "Solapur", "lat": 17.6599, "lng": 75.9064, "apt": "Solapur Airport", "stn": "Solapur Station"},
    {"name": "Amravati", "lat": 20.9320, "lng": 77.7523, "apt": None, "stn": "Amravati Station"},
    {"name": "Nanded", "lat": 19.1383, "lng": 77.3210, "apt": "Shri Guru Gobind Singh Ji Airport", "stn": "Hazur Sahib Nanded"},
    {"name": "Bikaner", "lat": 28.0229, "lng": 73.3119, "apt": "Bikaner Airport", "stn": "Bikaner Junction"},
    {"name": "Ajmer", "lat": 26.4499, "lng": 74.6399, "apt": "Kishangarh Airport", "stn": "Ajmer Junction"},
    {"name": "Kota", "lat": 25.2138, "lng": 75.8648, "apt": "Kota Airport", "stn": "Kota Junction"},
    {"name": "Bhavnagar", "lat": 21.7645, "lng": 72.1519, "apt": "Bhavnagar Airport", "stn": "Bhavnagar Terminus"},
    {"name": "Jamnagar", "lat": 22.4707, "lng": 70.0577, "apt": "Jamnagar Airport", "stn": "Jamnagar Station"},
    {"name": "Surat", "lat": 21.1702, "lng": 72.8311, "apt": "Surat Airport", "stn": "Surat Station"},
    {"name": "Kurnool", "lat": 15.8281, "lng": 78.0373, "apt": "Kurnool Airport", "stn": "Kurnool City"},
    {"name": "Nellore", "lat": 14.4426, "lng": 79.9865, "apt": None, "stn": "Nellore Station"},
    {"name": "Salem", "lat": 11.6643, "lng": 78.1460, "apt": "Salem Airport", "stn": "Salem Junction"},
    {"name": "Tirunelveli", "lat": 8.7139, "lng": 77.7567, "apt": "Tuticorin Airport", "stn": "Tirunelveli Junction"},
    {"name": "Vellore", "lat": 12.9165, "lng": 79.1325, "apt": None, "stn": "Katpadi Junction"},
    {"name": "Dhanbad", "lat": 23.7957, "lng": 86.4304, "apt": None, "stn": "Dhanbad Junction"},
    {"name": "Bokaro", "lat": 23.6693, "lng": 86.1511, "apt": None, "stn": "Bokaro Steel City"},
    {"name": "Asansol", "lat": 23.6739, "lng": 86.9524, "apt": "Kazi Nazrul Islam Airport", "stn": "Asansol Junction"},
    {"name": "Durgapur", "lat": 23.5204, "lng": 87.3119, "apt": "Kazi Nazrul Islam Airport", "stn": "Durgapur Station"},
    {"name": "Kharagpur", "lat": 22.3302, "lng": 87.3237, "apt": None, "stn": "Kharagpur Junction"},
    {"name": "Bilaspur", "lat": 22.0797, "lng": 82.1409, "apt": "Bilasa Devi Kevat Airport", "stn": "Bilaspur Junction"},
    {"name": "Durg", "lat": 21.1938, "lng": 81.2849, "apt": None, "stn": "Durg Junction"},
    {"name": "Kollam", "lat": 8.8932, "lng": 76.6141, "apt": None, "stn": "Kollam Junction"},
    {"name": "Thrissur", "lat": 10.5276, "lng": 76.2144, "apt": None, "stn": "Thrissur Station"},
    {"name": "Alappuzha", "lat": 9.4981, "lng": 76.3388, "apt": None, "stn": "Alappuzha Station"},
    {"name": "Kannur", "lat": 11.8745, "lng": 75.3704, "apt": "Kannur Int. Airport", "stn": "Kannur Station"},
    {"name": "Guntur", "lat": 16.3067, "lng": 80.4365, "apt": None, "stn": "Guntur Junction"},
    {"name": "Warangal", "lat": 17.9811, "lng": 79.5318, "apt": None, "stn": "Warangal Station"},
    {"name": "Nizamabad", "lat": 18.6725, "lng": 78.0941, "apt": None, "stn": "Nizamabad Junction"},
    {"name": "Karnal", "lat": 29.6857, "lng": 76.9905, "apt": None, "stn": "Karnal Station"},
    {"name": "Panipat", "lat": 29.3909, "lng": 76.9635, "apt": None, "stn": "Panipat Junction"},
    {"name": "Rohtak", "lat": 28.8955, "lng": 76.5892, "apt": None, "stn": "Rohtak Junction"},
    {"name": "Hisar", "lat": 29.1492, "lng": 75.7217, "apt": "Hisar Airport", "stn": "Hisar Junction"},
    {"name": "Bhatinda", "lat": 30.2110, "lng": 74.9455, "apt": "Bathinda Airport", "stn": "Bathinda Junction"},
    {"name": "Pathankot", "lat": 32.2643, "lng": 75.6469, "apt": "Pathankot Airport", "stn": "Pathankot Junction"},
    {"name": "Hoshiarpur", "lat": 31.5274, "lng": 75.9123, "apt": None, "stn": "Hoshiarpur Station"},
    {"name": "Imphal", "lat": 24.8170, "lng": 93.9368, "apt": "Bir Tikendrajit Int. Airport", "stn": None},
    {"name": "Aizawl", "lat": 23.7271, "lng": 92.7176, "apt": "Lengpui Airport", "stn": None},
    {"name": "Kohima", "lat": 25.6751, "lng": 94.1086, "apt": None, "stn": None},
    {"name": "Itanagar", "lat": 27.0844, "lng": 93.6053, "apt": "Donyi Polo Airport", "stn": "Naharlagun Station"},
    {"name": "Gangtok", "lat": 27.3389, "lng": 88.6065, "apt": "Pakyong Airport", "stn": None},
]

print("import { Haversine } from './Haversine';\n")
print("export interface GeoNode {")
print("  id: string;")
print("  name: string;")
print("  type: 'CITY' | 'AIRPORT' | 'STATION';")
print("  lat: number;")
print("  lng: number;")
print("  cityId?: string;")
print("}\n")
print("export const GEO_DB: GeoNode[] = [")

# Print top 20 cities (re-adding them)
top20 = [
  {"id": 'city_patna', "name": 'Patna', "type": 'CITY', "lat": 25.5941, "lng": 85.1376},
  {"id": 'city_kolkata', "name": 'Kolkata', "type": 'CITY', "lat": 22.5726, "lng": 88.3639},
  {"id": 'city_bangalore', "name": 'Bangalore', "type": 'CITY', "lat": 12.9716, "lng": 77.5946},
  {"id": 'city_delhi', "name": 'Delhi', "type": 'CITY', "lat": 28.7041, "lng": 77.1025},
  {"id": 'city_mumbai', "name": 'Mumbai', "type": 'CITY', "lat": 19.0760, "lng": 72.8777},
  {"id": 'city_chennai', "name": 'Chennai', "type": 'CITY', "lat": 13.0827, "lng": 80.2707},
  {"id": 'city_hyderabad', "name": 'Hyderabad', "type": 'CITY', "lat": 17.3850, "lng": 78.4867},
  {"id": 'city_ahmedabad', "name": 'Ahmedabad', "type": 'CITY', "lat": 23.0225, "lng": 72.5714},
  {"id": 'city_jaipur', "name": 'Jaipur', "type": 'CITY', "lat": 26.9124, "lng": 75.7873},
  {"id": 'city_lucknow', "name": 'Lucknow', "type": 'CITY', "lat": 26.8467, "lng": 80.9462},
  {"id": 'city_chandigarh', "name": 'Chandigarh', "type": 'CITY', "lat": 30.7333, "lng": 76.7794},
  {"id": 'city_guwahati', "name": 'Guwahati', "type": 'CITY', "lat": 26.1445, "lng": 91.7362},
  
  # Airports for top 20
  {"id": 'apt_patna', "name": 'Jay Prakash Narayan Airport', "type": 'AIRPORT', "lat": 25.5913, "lng": 85.0872, "cityId": 'city_patna'},
  {"id": 'apt_kolkata', "name": 'Netaji Subhas Chandra Bose Airport', "type": 'AIRPORT', "lat": 22.6531, "lng": 88.4449, "cityId": 'city_kolkata'},
  {"id": 'apt_bangalore', "name": 'Kempegowda Int. Airport', "type": 'AIRPORT', "lat": 13.1989, "lng": 77.7068, "cityId": 'city_bangalore'},
  {"id": 'apt_delhi', "name": 'Indira Gandhi Int. Airport', "type": 'AIRPORT', "lat": 28.5562, "lng": 77.1000, "cityId": 'city_delhi'},
  {"id": 'apt_mumbai', "name": 'Chhatrapati Shivaji Int. Airport', "type": 'AIRPORT', "lat": 19.0896, "lng": 72.8656, "cityId": 'city_mumbai'},
  {"id": 'apt_chennai', "name": 'Chennai Int. Airport', "type": 'AIRPORT', "lat": 12.9941, "lng": 80.1709, "cityId": 'city_chennai'},
  {"id": 'apt_hyderabad', "name": 'Rajiv Gandhi Int. Airport', "type": 'AIRPORT', "lat": 17.2403, "lng": 78.4294, "cityId": 'city_hyderabad'},
  {"id": 'apt_ahmedabad', "name": 'Sardar Vallabhbhai Patel Int. Airport', "type": 'AIRPORT', "lat": 23.0734, "lng": 72.6266, "cityId": 'city_ahmedabad'},
  {"id": 'apt_jaipur', "name": 'Jaipur Int. Airport', "type": 'AIRPORT', "lat": 26.8242, "lng": 75.8016, "cityId": 'city_jaipur'},
  {"id": 'apt_lucknow', "name": 'Chaudhary Charan Singh Airport', "type": 'AIRPORT', "lat": 26.7606, "lng": 80.8893, "cityId": 'city_lucknow'},
  {"id": 'apt_chandigarh', "name": 'Chandigarh Airport', "type": 'AIRPORT', "lat": 30.6735, "lng": 76.7885, "cityId": 'city_chandigarh'},
  {"id": 'apt_guwahati', "name": 'Lokpriya Gopinath Bordoloi Airport', "type": 'AIRPORT', "lat": 26.1061, "lng": 91.5859, "cityId": 'city_guwahati'},

  # Stations for top 20
  {"id": 'stn_patna', "name": 'Patna Junction', "type": 'STATION', "lat": 25.6030, "lng": 85.1360, "cityId": 'city_patna'},
  {"id": 'stn_howrah', "name": 'Howrah Station', "type": 'STATION', "lat": 22.5839, "lng": 88.3433, "cityId": 'city_kolkata'},
  {"id": 'stn_ksr', "name": 'KSR Bengaluru', "type": 'STATION', "lat": 12.9784, "lng": 77.5695, "cityId": 'city_bangalore'},
  {"id": 'stn_ndls', "name": 'New Delhi Railway Station', "type": 'STATION', "lat": 28.6415, "lng": 77.2183, "cityId": 'city_delhi'},
  {"id": 'stn_cstm', "name": 'CSMT Mumbai', "type": 'STATION', "lat": 18.9398, "lng": 72.8354, "cityId": 'city_mumbai'},
  {"id": 'stn_chennai', "name": 'Chennai Central', "type": 'STATION', "lat": 13.0822, "lng": 80.2755, "cityId": 'city_chennai'},
  {"id": 'stn_hyderabad', "name": 'Secunderabad Junction', "type": 'STATION', "lat": 17.4337, "lng": 78.5016, "cityId": 'city_hyderabad'},
  {"id": 'stn_ahmedabad', "name": 'Ahmedabad Junction', "type": 'STATION', "lat": 23.0256, "lng": 72.5979, "cityId": 'city_ahmedabad'},
  {"id": 'stn_jaipur', "name": 'Jaipur Junction', "type": 'STATION', "lat": 26.9196, "lng": 75.7880, "cityId": 'city_jaipur'},
  {"id": 'stn_lucknow', "name": 'Lucknow Junction', "type": 'STATION', "lat": 26.8306, "lng": 80.9205, "cityId": 'city_lucknow'},
  {"id": 'stn_chandigarh', "name": 'Chandigarh Junction', "type": 'STATION', "lat": 30.7046, "lng": 76.8016, "cityId": 'city_chandigarh'},
  {"id": 'stn_guwahati', "name": 'Guwahati Station', "type": 'STATION', "lat": 26.1843, "lng": 91.7483, "cityId": 'city_guwahati'},
]

for node in top20:
  cityIdStr = f", cityId: '{node['cityId']}'" if 'cityId' in node else ""
  print(f"  {{ id: '{node['id']}', name: '{node['name']}', type: '{node['type']}', lat: {node['lat']}, lng: {node['lng']}{cityIdStr} }},")

for city in cities:
    cid = "city_" + city['name'].lower().replace(" ", "_")
    print(f"  {{ id: '{cid}', name: '{city['name']}', type: 'CITY', lat: {city['lat']}, lng: {city['lng']} }},")
    
    if city['apt']:
        apt_id = "apt_" + city['name'].lower().replace(" ", "_")
        print(f"  {{ id: '{apt_id}', name: '{city['apt']}', type: 'AIRPORT', lat: {city['lat']}, lng: {city['lng']}, cityId: '{cid}' }},")
    
    if city['stn']:
        stn_id = "stn_" + city['name'].lower().replace(" ", "_")
        print(f"  {{ id: '{stn_id}', name: '{city['stn']}', type: 'STATION', lat: {city['lat']}, lng: {city['lng']}, cityId: '{cid}' }},")

print("];\n")

print("""export const getGeoNode = (query: string): GeoNode | undefined => {
  const search = query.toLowerCase();
  return GEO_DB.find(node => node.name.toLowerCase().includes(search) || node.id.includes(search));
};

export const findNearbyAirports = (lat: number, lng: number, maxRadiusKm: number = 1000): GeoNode[] => {
  return GEO_DB.filter(node => node.type === 'AIRPORT').filter(apt => {
    const dist = Haversine.getDistance(lat, lng, apt.lat, apt.lng);
    return dist <= maxRadiusKm;
  });
};""")
