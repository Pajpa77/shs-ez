const fs = require('fs');
let code = fs.readFileSync('src/context/RescueContext.tsx', 'utf8');

const refsCode = `
  const isRealGpsActiveRef = useRef(isRealGpsActive);
  const currentUserRef = useRef(currentUser);
  const userArrivalStatusesRef = useRef(userArrivalStatuses);

  useEffect(() => {
    isRealGpsActiveRef.current = isRealGpsActive;
    currentUserRef.current = currentUser;
    userArrivalStatusesRef.current = userArrivalStatuses;
  }, [isRealGpsActive, currentUser, userArrivalStatuses]);
`;

code = code.replace(/\/\/ Real GPS tracking using navigator\.geolocation/g, refsCode + '\n  // Real GPS tracking using navigator.geolocation');

// Only inside the useEffect for geolocation
let startIdx = code.indexOf('// Real GPS tracking using navigator.geolocation');
let endIdx = code.indexOf('}, [isRealGpsActive, currentUser, syncLocationToCloud, userArrivalStatuses]);');
if (startIdx !== -1 && endIdx !== -1) {
    let before = code.substring(0, startIdx);
    let after = code.substring(endIdx + 77); // length of the replaced string
    let middle = code.substring(startIdx, endIdx);
    
    middle = middle.replace(/currentUser\.arrivalStatus/g, 'currentUserRef.current?.arrivalStatus');
    middle = middle.replace(/currentUser\.role/g, 'currentUserRef.current?.role');
    middle = middle.replace(/currentUser\.id/g, 'currentUserRef.current?.id');
    middle = middle.replace(/currentUser\.canLeadOperations/g, 'currentUserRef.current?.canLeadOperations');
    middle = middle.replace(/currentUser\.operationalRole/g, 'currentUserRef.current?.operationalRole');
    middle = middle.replace(/currentUser &&/g, 'currentUserRef.current &&');
    middle = middle.replace(/currentUser \?/g, 'currentUserRef.current ?');
    middle = middle.replace(/userArrivalStatuses\[/g, 'userArrivalStatusesRef.current[');
    middle = middle.replace(/isRealGpsActive &&/g, 'isRealGpsActiveRef.current &&');
    
    code = before + middle + '}, [isRealGpsActive, syncLocationToCloud]);' + after;
    fs.writeFileSync('src/context/RescueContext.tsx', code);
    console.log('Patched');
} else {
    console.log('Indices not found!');
}
